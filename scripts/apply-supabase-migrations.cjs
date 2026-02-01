#!/usr/bin/env node

/**
 * Apply Supabase SQL migrations directly via Postgres, and keep
 * `supabase_migrations.schema_migrations` in sync.
 *
 * Default behavior is safe: it prints pending migrations and exits.
 * To actually apply, you must pass `--yes`.
 *
 * Env (in .env.local):
 *   - SUPABASE_DB_CONNECTION_STRING (preferred)
 *     OR SUPABASE_DB_URL / DATABASE_URL
 *
 * Usage:
 *   node scripts/apply-supabase-migrations.cjs              # dry-run (default)
 *   node scripts/apply-supabase-migrations.cjs --yes        # apply
 *   node scripts/apply-supabase-migrations.cjs --only <ver> # one migration
 *   node scripts/apply-supabase-migrations.cjs --from <ver> # start at version
 *   node scripts/apply-supabase-migrations.cjs --to <ver>   # stop at version
 */

require('dotenv').config({ path: '.env.local' })

const dns = require('dns')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const { Client } = require('pg')

function parseArgs(argv) {
  const args = argv.slice(2)
  const flags = new Set()
  const values = new Map()

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]
    if (!token.startsWith('--')) continue

    const key = token.slice(2)
    const next = args[index + 1]

    if (!next || next.startsWith('--')) {
      flags.add(key)
      continue
    }

    values.set(key, next)
    index += 1
  }

  return { flags, values }
}

function printHelp() {
  console.log(`
Apply Supabase migrations (supabase/migrations/*.sql) via Postgres.

This script prints pending migrations by default. To apply, pass --yes.

Usage:
  node scripts/apply-supabase-migrations.cjs [options]

Options:
  --yes            Apply pending migrations + mark them applied
  --dry-run        Print what would run (default)
  --only <ver>     Apply only a single migration version
  --from <ver>     Apply starting from version (inclusive)
  --to <ver>       Apply up to version (inclusive)
  --allow-dirty    Allow running with uncommitted migration files
  --help           Show this help

Required env (in .env.local):
  SUPABASE_DB_CONNECTION_STRING (preferred) or SUPABASE_DB_URL / DATABASE_URL
`)
}

function getConnectionString() {
  return (
    process.env.SUPABASE_DB_CONNECTION_STRING ||
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL
  )
}

function getDirtyMigrationStatus() {
  try {
    const output = execSync('git status --porcelain=v1 -- supabase/migrations', {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    })
    return output.trim()
  } catch {
    return ''
  }
}

function looksLikePlaceholderPassword(password) {
  if (!password) return true
  const value = String(password)
  return (
    value.includes('YOUR-PASSWORD') ||
    value.includes('YOUR_PASSWORD') ||
    value.includes('<') ||
    value.includes('[')
  )
}

function resolve4(hostname) {
  return new Promise((resolve) => {
    dns.resolve4(hostname, (error, addresses) => resolve({ error, addresses }))
  })
}

function resolve6(hostname) {
  return new Promise((resolve) => {
    dns.resolve6(hostname, (error, addresses) => resolve({ error, addresses }))
  })
}

async function printConnectivityHints(connectionString) {
  let parsed
  try {
    parsed = new URL(connectionString)
  } catch {
    return
  }

  const hostname = parsed.hostname
  const password = parsed.password

  if (looksLikePlaceholderPassword(password)) {
    console.error('❌ Connection string appears to contain a placeholder password.')
    console.error(
      '   Replace it with your Supabase database password from Dashboard > Database > Settings.'
    )
  }

  if (!hostname) return

  const [v4, v6] = await Promise.all([resolve4(hostname), resolve6(hostname)])
  const hasV4 = Array.isArray(v4.addresses) && v4.addresses.length > 0
  const hasV6 = Array.isArray(v6.addresses) && v6.addresses.length > 0

  if (!hasV4 && hasV6) {
    console.error(`❌ Hostname "${hostname}" resolves only to IPv6.`)
    console.error('   Use the "Connection pooling" connection string from Supabase Connect.')
  }
}

function getAllMigrationVersions(migrationsDir) {
  if (!fs.existsSync(migrationsDir)) return []
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => file.replace(/\.sql$/, ''))
    .sort()
}

function selectVersions(versions, { only, from, to }) {
  let selected = versions.slice()

  if (only) {
    if (!selected.includes(only)) {
      throw new Error(`Unknown migration version: ${only}`)
    }
    return [only]
  }

  if (from) {
    selected = selected.filter((version) => version >= from)
  }

  if (to) {
    selected = selected.filter((version) => version <= to)
  }

  return selected
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS supabase_migrations;

    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
      version text PRIMARY KEY,
      statements text[],
      name text
    );
  `)
}

async function getAppliedVersions(client) {
  try {
    const { rows } = await client.query(
      'SELECT version FROM supabase_migrations.schema_migrations ORDER BY version ASC;'
    )
    return new Set(rows.map((row) => row.version))
  } catch {
    return new Set()
  }
}

async function markApplied(client, version) {
  await client.query(
    `
      INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
      VALUES ($1, $2, ARRAY[]::text[])
      ON CONFLICT (version) DO NOTHING;
    `,
    [version, version]
  )
}

async function runSqlWithTransactionFallback(client, sql) {
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')
    return { usedTransaction: true }
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch (rollbackError) {
      console.warn('⚠️  ROLLBACK failed:', rollbackError?.message || rollbackError)
    }

    const message = String(error?.message || '')
    const transactionBlockOnly =
      message.includes('cannot run CREATE INDEX CONCURRENTLY in a transaction block') ||
      message.includes('cannot run VACUUM in a transaction block') ||
      message.includes('cannot run REINDEX in a transaction block')

    if (!transactionBlockOnly) throw error

    await client.query(sql)
    return { usedTransaction: false }
  }
}

async function main() {
  const { flags, values } = parseArgs(process.argv)

  if (flags.has('help')) {
    printHelp()
    process.exit(0)
  }

  const connectionString = getConnectionString()
  if (!connectionString) {
    console.error('❌ Missing Postgres connection string.')
    console.error('   Set SUPABASE_DB_CONNECTION_STRING in .env.local.')
    console.error('')
    console.error('Manual fallback:')
    console.error('  1) Run the migration SQL in Supabase Dashboard > SQL Editor')
    console.error('  2) Run: node mark-migrations-applied.cjs')
    process.exit(1)
  }

  await printConnectivityHints(connectionString)

  const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations')
  const allVersions = getAllMigrationVersions(migrationsDir)
  if (allVersions.length === 0) {
    console.log('ℹ️  No migrations found in supabase/migrations')
    process.exit(0)
  }

  const only = values.get('only')
  const from = values.get('from')
  const to = values.get('to')

  let selectedVersions
  try {
    selectedVersions = selectVersions(allVersions, { only, from, to })
  } catch (error) {
    console.error(`❌ ${error.message}`)
    process.exit(1)
  }

  const wantsApply = flags.has('yes')
  const isDryRun = flags.has('dry-run') || !wantsApply
  const allowDirty = flags.has('allow-dirty')

  const dirty = getDirtyMigrationStatus()
  if (dirty && !allowDirty) {
    console.error('❌ Refusing to run because `supabase/migrations` has uncommitted changes:')
    console.error(dirty)
    console.error('')
    console.error('Commit or delete the migration file(s) first, or re-run with --allow-dirty.')
    process.exit(1)
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })

  try {
    await client.connect()

    await ensureMigrationsTable(client)
    const applied = await getAppliedVersions(client)

    const pending = selectedVersions.filter((version) => !applied.has(version))
    if (pending.length === 0) {
      console.log('✅ No pending migrations.')
      process.exit(0)
    }

    console.log(`🧾 Pending migrations (${pending.length}):`)
    for (const version of pending) console.log(`- ${version}`)

    if (isDryRun) {
      console.log('')
      console.log('ℹ️  Dry-run mode. Re-run with --yes to apply.')
      process.exit(0)
    }

    let appliedCount = 0
    for (const version of pending) {
      const filePath = path.join(migrationsDir, `${version}.sql`)
      const sql = fs.readFileSync(filePath, 'utf8')

      console.log(`\n📝 Applying ${version}...`)
      const { usedTransaction } = await runSqlWithTransactionFallback(client, sql)
      await markApplied(client, version)

      appliedCount += 1
      console.log(`✅ Applied ${version} (${usedTransaction ? 'transaction' : 'no transaction'})`)
    }

    console.log(`\n🎉 Done. Applied ${appliedCount}/${pending.length} migrations.`)
  } catch (error) {
    console.error('\n❌ Migration run failed:')
    console.error(`   ${error.message || error}`)
    process.exitCode = 1
  } finally {
    try {
      await client.end()
    } catch (endError) {
      console.warn('⚠️  Failed to close DB connection:', endError?.message || endError)
    }
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error?.message || error)
  process.exit(1)
})


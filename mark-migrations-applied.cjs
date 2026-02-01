/**
 * Mark Migrations as Applied
 *
 * Prints SQL to mark migrations in `supabase/migrations` as already applied in
 * `supabase_migrations.schema_migrations` (the same tracking table the Supabase
 * CLI uses).
 *
 * Usage:
 *   node mark-migrations-applied.cjs
 *
 * Then copy/paste the printed SQL into Supabase Dashboard > SQL Editor.
 */

require('dotenv').config({ path: '.env.local' })

const fs = require('fs')
const path = require('path')

function getAllMigrations() {
  const migrationsDir = path.join(__dirname, 'supabase', 'migrations')
  if (!fs.existsSync(migrationsDir)) return []

  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .map((file) => file.replace(/\.sql$/, ''))
    .sort()
}

async function markMigrationsApplied() {
  console.log('📝 Marking local migrations as applied...\n')
  console.log('='.repeat(60))

  const createSchemaSql = `
CREATE SCHEMA IF NOT EXISTS supabase_migrations;

CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text PRIMARY KEY,
  statements text[],
  name text
);
`

  console.log('\n--- Copy and paste this in Supabase SQL Editor (once) ---\n')
  console.log(createSchemaSql.trim() + '\n')

  const appliedMigrations = getAllMigrations()
  if (appliedMigrations.length === 0) {
    console.log('⚠️  No migrations found in `supabase/migrations`.')
    console.log('='.repeat(60))
    return
  }

  console.log('--- Then run this to mark migrations as applied ---\n')
  for (const migration of appliedMigrations) {
    console.log(
      `INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('${migration}', '${migration}') ON CONFLICT DO NOTHING;`
    )
  }

  console.log('\n' + '='.repeat(60))
  console.log('\nNext steps:')
  console.log('1) Copy the SQL above')
  console.log('2) Supabase Dashboard > SQL Editor')
  console.log('3) Paste + run')
}

markMigrationsApplied().catch((error) => {
  console.error('\n❌ Unexpected error:', error?.message || error)
  process.exit(1)
})


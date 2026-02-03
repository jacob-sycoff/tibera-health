# Agent Notes (Read Me First)

## Supabase SQL Migrations (Custom)

This repo keeps Supabase/Postgres schema changes in version-controlled SQL files and provides scripts to:

- Apply pending migrations via a direct Postgres connection
- Keep Supabase’s tracking table (`supabase_migrations.schema_migrations`) in sync

Supabase Dashboard’s SQL Editor does **not** update the tracking table automatically — if you apply SQL manually, you must sync it.

### Migration files

- Location: `supabase/migrations/*.sql`
- Current repo includes legacy migrations like `001_initial_schema.sql` (still supported).
- Going forward, prefer: `YYYYMMDDHHMMSS_<short_description>.sql` (lexicographic order == apply order)

### Tracking table

Supabase CLI tracks applied migrations in:

`supabase_migrations.schema_migrations (version text PRIMARY KEY, statements text[], name text)`

This system uses the same table, where `version` is the migration filename without `.sql`.

---

## Apply migrations

### Option A: Automated (preferred when DB connection available)

1. Set `SUPABASE_DB_CONNECTION_STRING` in `.env.local` (use Supabase “Connection pooling” URI if needed)
2. Dry-run (prints pending): `npm run db:migrate` (or `pnpm db:migrate`)
3. Apply + mark applied: `npm run db:migrate -- --yes`

Script: `scripts/apply-supabase-migrations.cjs`

- Creates `supabase_migrations.schema_migrations` if missing
- Applies pending migrations in filename order
- Inserts a row into `schema_migrations` after each successful migration
- Refuses to run if `supabase/migrations` is dirty (override with `--allow-dirty`)

### Option B: Manual (fallback)

1. Copy/paste the migration SQL into Supabase Dashboard > SQL Editor and run it
2. Run: `npm run db:mark-migrations`
3. Copy the printed SQL and run it in Supabase Dashboard > SQL Editor (to sync the tracking table)

Script: `mark-migrations-applied.cjs`

---

## Creating a new migration

1. Create the file (timestamp name preferred):

   `supabase/migrations/20260118120000_add_new_feature.sql`

2. Write idempotent SQL (use `IF EXISTS` / `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
3. Commit the migration file
4. Apply via `npm run db:migrate -- --yes` (or manual + `db:mark-migrations`)

### Key rules

1. Never edit/rename applied migrations — create a new one
2. Keep SQL idempotent
3. Keep `schema_migrations` in sync if you apply manually
4. Enable RLS + policies on any new tables
5. Never delete/rename files (especially untracked/WIP) unless the user explicitly asks; if something is untracked, leave it alone or add/track it—do not remove it.

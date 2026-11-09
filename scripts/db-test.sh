#!/usr/bin/env bash
# Rebuilds a scratch database from the migrations on a plain PostgreSQL +
# PostGIS server (using the Supabase shim), loads the seed and runs the SQL
# tests in supabase/tests. Usage:
#   PGHOST=/tmp PGPORT=54329 PGUSER=postgres scripts/db-test.sh
set -euo pipefail

DB="${TEST_DB:-aio_test}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

"${PSQL[@]}" -d postgres -c "drop database if exists ${DB}" -c "create database ${DB}"
"${PSQL[@]}" -d "$DB" -f "$ROOT/supabase/tests/00_supabase_shim.sql"

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ migration $(basename "$f")"
  "${PSQL[@]}" -d "$DB" -f "$f"
done

echo "→ seed"
"${PSQL[@]}" -d "$DB" -f "$ROOT/supabase/seed.sql"

status=0
for f in "$ROOT"/supabase/tests/[1-9]*.sql; do
  [ -e "$f" ] || continue
  echo "→ test $(basename "$f")"
  set +e
  "${PSQL[@]}" -o /dev/null -d "$DB" -f "$f" 2>&1 | sed -E 's/^psql:[^ ]+ (NOTICE|ERROR):  /  /'
  rc=${PIPESTATUS[0]}
  set -e
  [ "$rc" -eq 0 ] || status=1
done

if [ "$status" -eq 0 ]; then echo "✓ all database tests passed"; else echo "✗ database tests failed"; fi
exit "$status"

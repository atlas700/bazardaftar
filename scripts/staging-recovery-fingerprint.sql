-- shortcut: full-table sorting suits synthetic staging only; use a snapshot-aware
-- streaming verifier before applying this drill to a large business database.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL timezone = 'UTC';
SET LOCAL statement_timeout = '60s';
SELECT format(
  'SELECT jsonb_build_array(%L, count(*), md5(coalesce(string_agg(md5(to_jsonb(t)::text), '''' ORDER BY md5(to_jsonb(t)::text)), ''''))) FROM %I.%I AS t;',
  n.nspname || '.' || c.relname, n.nspname, c.relname
)
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'drizzle') AND c.relkind = 'r'
  -- Admission counters change during monitoring and are not business records.
  AND NOT (n.nspname = 'public' AND c.relname = 'request_rate_limits')
ORDER BY n.nspname, c.relname
\gexec
COMMIT;

-- Disposable PostgreSQL service only. Never apply these fixed test credentials
-- or recovery grants to a hosted/source database.
BEGIN;
CREATE ROLE afcs_restore_runtime LOGIN PASSWORD 'ci_only' NOINHERIT
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO afcs_restore_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO afcs_restore_runtime;
REVOKE UPDATE, DELETE ON public.audit_logs FROM afcs_restore_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO afcs_restore_runtime;
DO $$
BEGIN
  IF has_schema_privilege('afcs_restore_runtime', 'public', 'CREATE')
     OR has_table_privilege('afcs_restore_runtime', 'public.audit_logs', 'UPDATE')
     OR has_table_privilege('afcs_restore_runtime', 'public.audit_logs', 'DELETE')
     OR has_table_privilege('afcs_restore_runtime', 'public.audit_logs', 'TRUNCATE')
     OR NOT has_table_privilege('afcs_restore_runtime', 'public.audit_logs', 'SELECT')
     OR NOT has_table_privilege('afcs_restore_runtime', 'public.audit_logs', 'INSERT')
     OR EXISTS (SELECT FROM pg_class WHERE relnamespace = 'public'::regnamespace
                AND relowner = 'afcs_restore_runtime'::regrole)
  THEN RAISE EXCEPTION 'Restore runtime privileges are unsafe'; END IF;
END $$;
SET LOCAL ROLE afcs_restore_runtime;
DO $$
BEGIN
  BEGIN
    UPDATE public.audit_logs SET action = action WHERE false;
    RAISE EXCEPTION 'Runtime can update audit history';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    DELETE FROM public.audit_logs WHERE false;
    RAISE EXCEPTION 'Runtime can delete audit history';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
COMMIT;

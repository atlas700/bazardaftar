import unittest
from unittest.mock import patch

from staging_backup import verify_restored_data, configure_restore_runtime


class StagingRecoveryTests(unittest.TestCase):
    @patch("staging_backup.run")
    def test_changed_business_data_fails_even_when_migration_counts_match(self, run):
        run.side_effect = ['{"public.inventory_movements": [1, "source"]}',
                           '{"public.inventory_movements": [1, "changed"]}']
        with self.assertRaises(RuntimeError):
            verify_restored_data({"source": "read-only"}, {"target": "disposable"})

    @patch("staging_backup.run")
    def test_matching_rows_report_only_verified_table_count(self, run):
        run.return_value = '["drizzle.__drizzle_migrations", 18, "digest"]\n["public.audit_logs", 2, "digest"]'
        self.assertEqual(verify_restored_data({}, {}), 2)
        from pathlib import Path
        sql = Path(run.call_args.args[0][-1]).read_text()
        self.assertIn("request_rate_limits", sql)
        self.assertIn("REPEATABLE READ", sql)

    @patch("staging_backup.run")
    def test_runtime_grants_are_applied_only_to_fixed_disposable_target(self, run):
        with self.assertRaises(ValueError):
            configure_restore_runtime({"PGHOST": "source.neon.tech", "PGDATABASE": "production"})
        run.assert_not_called()

    @patch("staging_backup.run")
    def test_runtime_grant_failure_stops_recovery(self, run):
        run.side_effect = RuntimeError("permission verification failed")
        with self.assertRaises(RuntimeError):
            configure_restore_runtime({"PGHOST": "restore", "PGDATABASE": "afcs_restore_drill"})


if __name__ == "__main__":
    unittest.main()

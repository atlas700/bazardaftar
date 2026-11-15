import unittest
from pathlib import Path
from unittest.mock import patch

from staging_backup import verify_restored_data, configure_restore_runtime, report_backup_freshness


class StagingRecoveryTests(unittest.TestCase):
    @patch("staging_backup.urlopen")
    def test_freshness_monitor_updates_only_with_short_lived_status_link(self, urlopen):
        import json
        from datetime import datetime, timezone
        from unittest.mock import Mock
        s3 = Mock()
        s3.generate_presigned_url.return_value = "https://s3.us-east-005.backblazeb2.com/private/status?signature=private"
        urlopen.return_value.__enter__.return_value.status = 200
        report_backup_freshness(s3, {
            "BACKBLAZE_BUCKET_NAME": "private", "STAGING_BACKUP_MONITOR_ID": "123",
            "UPTIMEROBOT_API_KEY": "private-api-key",
        }, {"recoveryPoint": datetime.now(timezone.utc).isoformat()})
        self.assertLessEqual(s3.generate_presigned_url.call_args.kwargs["ExpiresIn"], 2700)
        self.assertEqual(s3.put_object.call_args.kwargs["Body"], b"ok")
        request = urlopen.call_args.args[0]
        self.assertEqual(json.loads(request.data), {"url": s3.generate_presigned_url.return_value})
        self.assertEqual(request.method, "PATCH")

    @patch("staging_backup.urlopen")
    def test_stale_recovery_point_never_resets_monitor(self, urlopen):
        from unittest.mock import Mock
        s3 = Mock()
        with self.assertRaises(ValueError):
            report_backup_freshness(s3, {}, {"recoveryPoint": "2020-01-01T00:00:00Z"})
        s3.put_object.assert_not_called()
        urlopen.assert_not_called()

    @patch("staging_backup.urlopen")
    def test_failed_marker_upload_never_resets_monitor(self, urlopen):
        from datetime import datetime, timezone
        from unittest.mock import Mock
        s3 = Mock()
        s3.put_object.side_effect = RuntimeError("storage unavailable")
        with self.assertRaises(RuntimeError):
            report_backup_freshness(s3, {"BACKBLAZE_BUCKET_NAME": "private", "STAGING_BACKUP_MONITOR_ID": "123"},
                                    {"recoveryPoint": datetime.now(timezone.utc).isoformat()})
        urlopen.assert_not_called()

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
        sql = Path(run.call_args.args[0][-1]).read_text()
        self.assertIn("request_rate_limits", sql)
        self.assertIn("REPEATABLE READ", sql)

    @patch("staging_backup.run", return_value="")
    def test_missing_fingerprint_is_not_success(self, run):
        with self.assertRaises(RuntimeError):
            verify_restored_data({}, {})

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

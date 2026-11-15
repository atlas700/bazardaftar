import os
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from staging_backup import backup, database_environment, main


class StagingBackupTests(unittest.TestCase):
    def setUp(self):
        self.environment = {
            "STAGING_DATABASE_URL": "postgresql://backup:private@ep-test.us-east-2.aws.neon.tech/test?sslmode=require",
            "BACKBLAZE_BUCKET_NAME": "test-backups",
            "BACKBLAZE_BUCKET_REGION": "us-east-005",
            "BACKBLAZE_BUCKET_ENDPOINT": "https://s3.us-east-005.backblazeb2.com",
            "BACKBLAZE_BUCKET_KEY_ID": "test-key-id",
            "BACKBLAZE_BUCKET_APP_KEY": "test-private-key",
        }

    def test_rejects_pooled_insecure_or_foreign_database_before_running_tools(self):
        for url in [
            self.environment["STAGING_DATABASE_URL"].replace("ep-test.", "ep-test-pooler."),
            self.environment["STAGING_DATABASE_URL"].replace("sslmode=require", "sslmode=disable"),
            self.environment["STAGING_DATABASE_URL"].replace("neon.tech", "example.com"),
        ]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                database_environment(url)

    def test_keeps_database_password_out_of_command_arguments(self):
        env = database_environment(self.environment["STAGING_DATABASE_URL"])
        self.assertEqual(env["PGPASSWORD"], "private")
        self.assertEqual(env["PGSSLMODE"], "require")
        self.assertEqual(env["PGCONNECT_TIMEOUT"], "10")

    @patch("staging_backup.run")
    def test_dump_failure_never_uploads_or_reports_success(self, run):
        run.side_effect = RuntimeError("dump failed")
        s3 = Mock()
        with self.assertRaises(RuntimeError):
            backup(s3, self.environment)
        s3.upload_file.assert_not_called()

    @patch("staging_backup.run")
    def test_upload_is_verified_before_success_and_dump_is_removed(self, run):
        def command(args, env):
            if args[0] == "psql":
                return "2026-11-15T06:00:00Z"
            if args[0] == "pg_dump":
                Path(args[args.index("--file") + 1]).write_bytes(b"test archive")
            return ""

        run.side_effect = command
        s3 = Mock()

        def upload(path, bucket, key, ExtraArgs):
            self.assertTrue(Path(path).exists())
            self.assertEqual(ExtraArgs["ServerSideEncryption"], "AES256")
            self.assertTrue(key.startswith("staging/postgres/"))
            s3.head_object.return_value = {
                "ContentLength": Path(path).stat().st_size,
                "Metadata": ExtraArgs["Metadata"],
                "ServerSideEncryption": "AES256",
            }

        s3.upload_file.side_effect = upload
        result = backup(s3, self.environment)
        self.assertEqual(result["bytes"], len(b"test archive"))
        self.assertEqual(result["recoveryPoint"], "2026-11-15T06:00:00Z")
        self.assertFalse(Path(s3.upload_file.call_args.args[0]).exists())
        for call in run.call_args_list:
            self.assertNotIn("private", " ".join(call.args[0]))
        s3.head_object.assert_called_once()

    @patch("staging_backup.run")
    def test_remote_verification_failure_is_not_success(self, run):
        def command(args, env):
            if args[0] == "pg_dump":
                Path(args[args.index("--file") + 1]).write_bytes(b"archive")
            return "2026-11-15T06:00:00Z"

        run.side_effect = command
        s3 = Mock()
        s3.head_object.return_value = {"ContentLength": 0, "Metadata": {}, "ServerSideEncryption": "AES256"}
        with self.assertRaises(RuntimeError):
            backup(s3, self.environment)

    @patch.dict(os.environ, {}, clear=True)
    @patch("builtins.print")
    def test_entrypoint_redacts_errors_and_returns_failure(self, output):
        self.assertEqual(main(), 1)
        self.assertNotIn("private", str(output.call_args_list))


if __name__ == "__main__":
    unittest.main()

"""Back up the synthetic Neon staging database to private Backblaze B2 storage."""

import hashlib
import json
import math
import os
import re
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit
from urllib.request import Request, urlopen
from uuid import uuid4


def database_environment(url):
    parsed = urlsplit(url)
    query = parse_qs(parsed.query)
    if (
        parsed.scheme not in ("postgres", "postgresql")
        or not (parsed.hostname or "").endswith(".neon.tech")
        or "-pooler." in parsed.hostname
        or not parsed.username or not parsed.password or not parsed.path.strip("/")
        or query.get("sslmode", [None])[-1] not in ("require", "verify-ca", "verify-full")
        or set(query) - {"sslmode", "channel_binding"}
        or parsed.fragment
    ):
        raise ValueError("A direct Neon staging URL with TLS is required.")
    env = {key: value for key, value in os.environ.items() if not key.startswith("PG")}
    env.update({
        "PGHOST": parsed.hostname, "PGPORT": str(parsed.port or 5432),
        "PGDATABASE": unquote(parsed.path[1:]), "PGUSER": unquote(parsed.username),
        "PGPASSWORD": unquote(parsed.password), "PGSSLMODE": query["sslmode"][-1],
        "PGCHANNELBINDING": query.get("channel_binding", ["prefer"])[-1],
        "PGCONNECT_TIMEOUT": "10",
    })
    return env


def run(args, env):
    result = subprocess.run(args, env=env, capture_output=True, text=True, timeout=300)
    if result.returncode:
        # Tool errors can contain credentials, SQL, or business records.
        print(json.dumps({"event": "staging_backup_tool_failed", "tool": args[0], "exitCode": result.returncode}))
        raise RuntimeError("PostgreSQL tool failed.")
    return result.stdout.strip()


def backup(s3, environment):
    env = database_environment(environment["STAGING_DATABASE_URL"])
    bucket = environment["BACKBLAZE_BUCKET_NAME"]
    with tempfile.TemporaryDirectory(prefix="bazardaftar-backup-") as directory:
        archive = Path(directory) / "database.dump"
        recovery_point = run([
            "psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c",
            "select to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')",
        ], env)
        datetime.fromisoformat(recovery_point.replace("Z", "+00:00"))
        run(["pg_dump", "--format=custom", "--no-owner", "--no-privileges", "--file", str(archive)], env)
        run(["pg_restore", "--list", str(archive)], env)
        with archive.open("rb") as source:
            checksum = hashlib.file_digest(source, "sha256").hexdigest()
        size = archive.stat().st_size
        if not size:
            raise RuntimeError("Backup archive is empty.")
        key = "staging/postgres/" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid4().hex + ".dump"
        metadata = {"sha256": checksum, "recovery-point": recovery_point}
        s3.upload_file(str(archive), bucket, key, ExtraArgs={
            "ServerSideEncryption": "AES256", "Metadata": metadata,
            "ContentType": "application/octet-stream",
        })
        saved = s3.head_object(Bucket=bucket, Key=key)
        if saved["ContentLength"] != size or saved.get("Metadata") != metadata or saved.get("ServerSideEncryption") != "AES256":
            raise RuntimeError("Uploaded backup verification failed.")
        return {"key": key, "bytes": size, "sha256": checksum, "recoveryPoint": recovery_point}


def verify_restored_data(source_env, target_env):
    script = Path(__file__).with_name("staging-recovery-fingerprint.sql")
    command = ["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-f", str(script)]
    source = run(command, source_env)
    restored = run(command, target_env)
    if not source or source != restored:
        raise RuntimeError("Restored records differ from staging; pause synthetic writes and repeat the drill.")
    return len(source.splitlines())


def configure_restore_runtime(env):
    if env.get("PGHOST") != "restore" or env.get("PGDATABASE") != "afcs_restore_drill":
        raise ValueError("Runtime grants require the fixed disposable restore service.")
    run(["psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-f",
         str(Path(__file__).with_name("staging-restore-runtime.sql"))], env)


def report_backup_freshness(s3, environment, saved):
    point = datetime.fromisoformat(saved["recoveryPoint"].replace("Z", "+00:00"))
    age = (datetime.now(timezone.utc) - point).total_seconds()
    lifetime = min(2700, 2700 - math.ceil(age))
    if lifetime <= 0 or age < -60:
        raise ValueError("Recovery point is stale or in the future.")
    monitor = environment["STAGING_BACKUP_MONITOR_ID"]
    if not re.fullmatch(r"[0-9]+", monitor):
        raise ValueError("Invalid backup freshness monitor.")
    # A separate harmless marker expires with the recovery point; never share an archive URL.
    key = "staging/postgres/status/" + uuid4().hex + ".txt"
    s3.put_object(Bucket=environment["BACKBLAZE_BUCKET_NAME"], Key=key, Body=b"ok",
                  ServerSideEncryption="AES256", CacheControl="no-store", ContentType="text/plain")
    url = s3.generate_presigned_url("get_object", Params={
        "Bucket": environment["BACKBLAZE_BUCKET_NAME"], "Key": key,
    }, ExpiresIn=lifetime)
    request = Request(f"https://api.uptimerobot.com/v3/monitors/{monitor}", method="PATCH",
                      data=json.dumps({"url": url}).encode(), headers={
                          "Authorization": "Bearer " + environment["UPTIMEROBOT_API_KEY"],
                          "Content-Type": "application/json",
                      })
    with urlopen(request, timeout=30) as response:
        if response.status != 200:
            raise RuntimeError("Backup freshness monitor update failed.")


def restore_drill(s3, environment, saved):
    # This hostname/database belongs only to the job's disposable PostgreSQL service.
    env = {key: value for key, value in os.environ.items() if not key.startswith("PG")}
    env.update({"PGHOST": "restore", "PGPORT": "5432", "PGDATABASE": "afcs_restore_drill",
                "PGUSER": "restore", "PGPASSWORD": "ci_only", "PGSSLMODE": "disable", "PGCONNECT_TIMEOUT": "10"})
    objects = run(["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c",
                   "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace "
                   "where n.nspname !~ '^pg_' and n.nspname <> 'information_schema' "
                   "and c.relkind in ('r','p','v','m','S','f')"], env)
    if objects != "0":
        raise RuntimeError("Restore target is not empty.")
    with tempfile.TemporaryDirectory(prefix="bazardaftar-restore-") as directory:
        archive = Path(directory) / "downloaded.dump"
        s3.download_file(environment["BACKBLAZE_BUCKET_NAME"], saved["key"], str(archive))
        with archive.open("rb") as source:
            checksum = hashlib.file_digest(source, "sha256").hexdigest()
        if checksum != saved["sha256"]:
            raise RuntimeError("Downloaded backup checksum mismatch.")
        run(["pg_restore", "--dbname", "afcs_restore_drill", "--no-owner", "--no-privileges", "--exit-on-error", "--single-transaction", str(archive)], env)
        migrations = run(["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c",
                          "select count(*) from drizzle.__drizzle_migrations"], env)
        journal = Path(__file__).resolve().parent.parent / "drizzle/meta/_journal.json"
        if int(migrations) != len(json.loads(journal.read_text())["entries"]):
            raise RuntimeError("Restored migration history does not match the repository.")
        tables = verify_restored_data(database_environment(environment["STAGING_DATABASE_URL"]), env)
        configure_restore_runtime(env)
        return {"restoredMigrations": int(migrations), "verifiedTables": tables, "restrictedRuntimeVerified": True}


def main():
    try:
        required = ["STAGING_DATABASE_URL", "BACKBLAZE_BUCKET_NAME", "BACKBLAZE_BUCKET_REGION",
                    "BACKBLAZE_BUCKET_ENDPOINT", "BACKBLAZE_BUCKET_KEY_ID", "BACKBLAZE_BUCKET_APP_KEY",
                    "UPTIMEROBOT_API_KEY", "STAGING_BACKUP_MONITOR_ID"]
        if any(not os.environ.get(name) for name in required):
            raise ValueError("Missing backup configuration.")
        region = os.environ["BACKBLAZE_BUCKET_REGION"]
        if not re.fullmatch(r"[a-z]{2}-[a-z]+-\d{3}", region) or os.environ["BACKBLAZE_BUCKET_ENDPOINT"] != f"https://s3.{region}.backblazeb2.com":
            raise ValueError("Unexpected Backblaze endpoint.")
        database_environment(os.environ["STAGING_DATABASE_URL"])
        import boto3
        from botocore.config import Config

        client = boto3.client(
            "s3", endpoint_url=os.environ["BACKBLAZE_BUCKET_ENDPOINT"], region_name=region,
            aws_access_key_id=os.environ["BACKBLAZE_BUCKET_KEY_ID"],
            aws_secret_access_key=os.environ["BACKBLAZE_BUCKET_APP_KEY"],
            config=Config(signature_version="s3v4", request_checksum_calculation="when_required",
                          response_checksum_validation="when_required", connect_timeout=10, read_timeout=60),
        )
        saved = backup(client, os.environ)
        print(json.dumps({"event": "staging_backup_completed", **saved}))
        print(json.dumps({"event": "staging_restore_completed", **restore_drill(client, os.environ, saved)}))
        report_backup_freshness(client, os.environ, saved)
        print(json.dumps({"event": "staging_backup_freshness_updated"}))
        return 0
    except Exception as error:
        print(json.dumps({"event": "staging_backup_failed", "kind": type(error).__name__}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

"""Back up the synthetic Neon staging database to private Backblaze B2 storage."""

import hashlib
import json
import os
import re
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit
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


def main():
    try:
        required = ["STAGING_DATABASE_URL", "BACKBLAZE_BUCKET_NAME", "BACKBLAZE_BUCKET_REGION",
                    "BACKBLAZE_BUCKET_ENDPOINT", "BACKBLAZE_BUCKET_KEY_ID", "BACKBLAZE_BUCKET_APP_KEY"]
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
        print(json.dumps({"event": "staging_backup_completed", **backup(client, os.environ)}))
        return 0
    except Exception as error:
        print(json.dumps({"event": "staging_backup_failed", "kind": type(error).__name__}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

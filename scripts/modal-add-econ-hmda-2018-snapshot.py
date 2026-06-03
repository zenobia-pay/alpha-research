"""Direct Modal-volume addition for HMDA 2018 snapshot ZIPs."""

from __future__ import annotations

import csv
import hashlib
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import modal


APP_NAME = "econ-direct-hmda-2018-snapshot"
DATASET_ROOT = Path("/data/datasets/econ")
RAW_DIR = DATASET_ROOT / "raw" / "hmda_2018_snapshot"
REFERER = "https://ffiec.cfpb.gov/data-publication/snapshot-national-loan-level-dataset/2018"
FILES = [
    {
        "filename": "2018_public_lar_csv.zip",
        "url": "https://files.ffiec.cfpb.gov/static-data/snapshot/2018/2018_public_lar_csv.zip",
        "source_key": "hmda_2018_lar",
    },
    {
        "filename": "2018_public_ts_csv.zip",
        "url": "https://files.ffiec.cfpb.gov/static-data/snapshot/2018/2018_public_ts_csv.zip",
        "source_key": "hmda_2018_ts",
    },
    {
        "filename": "2018_public_msamd_csv.zip",
        "url": "https://files.ffiec.cfpb.gov/static-data/snapshot/2018/2018_public_msamd_csv.zip",
        "source_key": "hmda_2018_msamd",
    },
    {
        "filename": "2018_public_panel_csv.zip",
        "url": "https://files.ffiec.cfpb.gov/static-data/snapshot/2018/2018_public_panel_csv.zip",
        "source_key": "hmda_2018_panel",
    },
]

app = modal.App(APP_NAME)
volume = modal.Volume.from_name("agent-dataset")
image = modal.Image.debian_slim()


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _download(spec: dict[str, str], destination: Path) -> dict[str, object]:
    request = Request(
        spec["url"],
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept": "application/zip,application/octet-stream,*/*",
            "Referer": REFERER,
        },
    )
    try:
        with urlopen(request, timeout=300) as response:
            with destination.open("wb") as handle:
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    handle.write(chunk)
            return {
                "url": spec["url"],
                "status": getattr(response, "status", None),
                "content_type": response.headers.get("Content-Type"),
                "content_length": response.headers.get("Content-Length"),
                "last_modified": response.headers.get("Last-Modified"),
                "etag": response.headers.get("ETag"),
            }
    except HTTPError as error:
        body = error.read(512).decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {error.code} while downloading {spec['url']}: {body}") from None


def _zip_summary(path: Path) -> dict[str, object]:
    with zipfile.ZipFile(path) as archive:
        bad_member = archive.testzip()
        members = []
        for info in archive.infolist():
            members.append(
                {
                    "filename": info.filename,
                    "file_size": info.file_size,
                    "compress_size": info.compress_size,
                }
            )
        return {
            "bad_member": bad_member,
            "members": members,
            "member_count": len(members),
            "total_uncompressed_bytes": sum(int(member["file_size"]) for member in members),
        }


def _upsert_manifest(entries: list[dict[str, object]]) -> dict[str, object]:
    manifest_path = DATASET_ROOT / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    existing = {entry.get("path"): entry for entry in manifest.get("entries", [])}
    for entry in entries:
        existing[entry["path"]] = entry
    manifest["entries"] = sorted(existing.values(), key=lambda entry: str(entry.get("path", "")))
    manifest["generated_at"] = datetime.now(timezone.utc).isoformat()
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    return {
        "manifest_path": "manifest.json",
        "entry_count": len(manifest["entries"]),
        "added_paths": [entry["path"] for entry in entries],
    }


@app.function(image=image, volumes={"/data": volume}, timeout=7200)
def add_hmda_2018_snapshot() -> dict[str, object]:
    if not DATASET_ROOT.exists():
        raise RuntimeError(f"Dataset root missing: {DATASET_ROOT}")

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    probe = RAW_DIR / ".write_probe"
    probe.write_text("ok\n")
    probe.unlink()

    retrieved_at = datetime.now(timezone.utc).isoformat()
    records: list[dict[str, object]] = []
    manifest_entries: list[dict[str, object]] = []
    for spec in FILES:
        output_path = RAW_DIR / spec["filename"]
        response = _download(spec, output_path)
        zip_summary = _zip_summary(output_path)
        record = {
            "source_key": spec["source_key"],
            "path": str(output_path.relative_to(DATASET_ROOT)),
            "filename": spec["filename"],
            "bytes": output_path.stat().st_size,
            "sha256": _sha256(output_path),
            "source_url": spec["url"],
            "retrieved_at": retrieved_at,
            "response": response,
            "zip": zip_summary,
        }
        records.append(record)
        manifest_entries.append(
            {
                "path": record["path"],
                "bytes": record["bytes"],
                "sha256": record["sha256"],
                "source_url": record["source_url"],
                "source_key": record["source_key"],
                "retrieved_at": retrieved_at,
            }
        )

    metadata = {
        "dataset_id": "econ",
        "source_key": "hmda_2018_snapshot",
        "title": "FFIEC/CFPB HMDA 2018 Snapshot National Loan-Level Dataset",
        "retrieved_at": retrieved_at,
        "raw_dir": str(RAW_DIR.relative_to(DATASET_ROOT)),
        "records": records,
        "notes": [
            "Provider-native official static ZIP files retained compressed.",
            "ZIP integrity tested with Python zipfile.testzip; bad_member is null on success.",
            "Downloaded directly in Modal against the mounted agent-dataset volume; no remote Codex worker was used.",
        ],
    }
    metadata_path = RAW_DIR / "metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2, sort_keys=True) + "\n")

    inventory_path = RAW_DIR / "inventory.csv"
    with inventory_path.open("w", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "filename",
                "path",
                "bytes",
                "sha256",
                "source_url",
                "retrieved_at",
                "last_modified",
                "etag",
                "member_count",
                "total_uncompressed_bytes",
                "bad_member",
            ],
        )
        writer.writeheader()
        for record in records:
            response = record["response"]
            zip_summary = record["zip"]
            assert isinstance(response, dict)
            assert isinstance(zip_summary, dict)
            writer.writerow(
                {
                    "filename": record["filename"],
                    "path": record["path"],
                    "bytes": record["bytes"],
                    "sha256": record["sha256"],
                    "source_url": record["source_url"],
                    "retrieved_at": record["retrieved_at"],
                    "last_modified": response.get("last_modified"),
                    "etag": response.get("etag"),
                    "member_count": zip_summary.get("member_count"),
                    "total_uncompressed_bytes": zip_summary.get("total_uncompressed_bytes"),
                    "bad_member": zip_summary.get("bad_member"),
                }
            )

    manifest_entries.extend(
        [
            {
                "path": str(metadata_path.relative_to(DATASET_ROOT)),
                "bytes": metadata_path.stat().st_size,
                "sha256": _sha256(metadata_path),
            },
            {
                "path": str(inventory_path.relative_to(DATASET_ROOT)),
                "bytes": inventory_path.stat().st_size,
                "sha256": _sha256(inventory_path),
            },
        ]
    )
    manifest_result = _upsert_manifest(manifest_entries)
    volume.commit()

    return {
        "status": "ok",
        "app": APP_NAME,
        "raw_dir": str(RAW_DIR.relative_to(DATASET_ROOT)),
        "retrieved_at": retrieved_at,
        "records": records,
        "total_bytes": sum(int(record["bytes"]) for record in records),
        "manifest": manifest_result,
    }


@app.local_entrypoint()
def main() -> None:
    print(json.dumps(add_hmda_2018_snapshot.remote(), indent=2, sort_keys=True))

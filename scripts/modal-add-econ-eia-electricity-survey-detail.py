"""Direct Modal-volume addition for EIA detailed electricity survey ZIPs."""

from __future__ import annotations

import csv
import hashlib
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

import modal


APP_NAME = "econ-direct-eia-electricity-survey-detail"
DATASET_ROOT = Path("/data/datasets/econ")
RAW_DIR = DATASET_ROOT / "raw" / "eia_electricity_survey_detail_20260603"
SOURCE_PAGE = "https://www.eia.gov/electricity/data/detail-data.php"
PACKAGES = [
    {
        "key": "eia_860_2024",
        "filename": "eia8602024.zip",
        "url": "https://www.eia.gov/electricity/data/eia860/xls/eia8602024.zip",
        "description": "Form EIA-860 annual electric generator, plant, and utility data for 2024.",
    },
    {
        "key": "eia_861_2024",
        "filename": "f8612024.zip",
        "url": "https://www.eia.gov/electricity/data/eia861/zip/f8612024.zip",
        "description": "Form EIA-861 annual electric power industry sales, revenue, customer, utility, and demand-side data for 2024.",
    },
    {
        "key": "eia_923_2024",
        "filename": "f923_2024.zip",
        "url": "https://www.eia.gov/electricity/data/eia923/archive/xls/f923_2024.zip",
        "description": "Form EIA-923 annual electric power plant operations, generation, fuel consumption, receipts, cost, and stocks data for 2024.",
    },
]

app = modal.App(APP_NAME)
volume = modal.Volume.from_name("agent-dataset")
image = modal.Image.debian_slim().apt_install("ca-certificates")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _download(package: dict[str, str], destination: Path) -> dict[str, object]:
    request = Request(package["url"], headers={"User-Agent": "alpha-research-canonical-direct/1.0"})
    with urlopen(request, timeout=600) as response:
        status = getattr(response, "status", 200)
        headers = dict(response.headers.items())
        with destination.open("wb") as handle:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                handle.write(chunk)
    if status != 200:
        raise RuntimeError(f"EIA returned status {status} for {package['url']}")
    return {"status": status, "headers": headers}


def _zip_summary(path: Path) -> dict[str, object]:
    with zipfile.ZipFile(path) as archive:
        bad_member = archive.testzip()
        members = [member for member in archive.infolist() if not member.is_dir()]
    if bad_member:
        raise RuntimeError(f"EIA ZIP {path.name} failed integrity at {bad_member}")
    return {
        "member_count": len(members),
        "compressed_bytes": sum(member.compress_size for member in members),
        "uncompressed_bytes": sum(member.file_size for member in members),
        "members": [
            {
                "name": member.filename,
                "compressed_bytes": member.compress_size,
                "uncompressed_bytes": member.file_size,
            }
            for member in members
        ],
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


@app.function(image=image, volumes={"/data": volume}, timeout=3600)
def add_eia_electricity_survey_detail() -> dict[str, object]:
    if not DATASET_ROOT.exists():
        raise RuntimeError(f"Dataset root missing: {DATASET_ROOT}")

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    probe = RAW_DIR / ".write_probe"
    probe.write_text("ok\n")
    probe.unlink()

    retrieved_at = datetime.now(timezone.utc).isoformat()
    records: list[dict[str, object]] = []
    manifest_entries: list[dict[str, object]] = []

    for package in PACKAGES:
        output_path = RAW_DIR / package["filename"]
        print(f"{package['key']}: {package['url']}", flush=True)
        response = _download(package, output_path)
        if output_path.stat().st_size < 4 or output_path.read_bytes()[:4] != b"PK\x03\x04":
            sample = output_path.read_bytes()[:300].decode("utf-8", errors="replace")
            output_path.unlink()
            raise RuntimeError(f"EIA response for {package['url']} was not a ZIP: {sample}")
        summary = _zip_summary(output_path)
        record = {
            "source_key": package["key"],
            "path": str(output_path.relative_to(DATASET_ROOT)),
            "filename": package["filename"],
            "bytes": output_path.stat().st_size,
            "sha256": _sha256(output_path),
            "source_url": package["url"],
            "source_page": SOURCE_PAGE,
            "retrieved_at": retrieved_at,
            "description": package["description"],
            "http": response,
            "zip": summary,
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
        "source_key": "eia_electricity_survey_detail",
        "title": "EIA detailed electricity survey files",
        "source_page": SOURCE_PAGE,
        "retrieved_at": retrieved_at,
        "raw_dir": str(RAW_DIR.relative_to(DATASET_ROOT)),
        "file_count": len(records),
        "total_bytes": sum(int(record["bytes"]) for record in records),
        "total_uncompressed_bytes": sum(int(record["zip"]["uncompressed_bytes"]) for record in records),
        "records": records,
        "notes": [
            "Provider-native EIA electricity survey ZIPs retained compressed to limit inode pressure.",
            "Downloaded directly in Modal against the mounted agent-dataset volume; no remote Codex worker was used.",
            "This captures latest final annual 2024 Form EIA-860, EIA-861, and EIA-923 packages.",
        ],
    }
    metadata_path = RAW_DIR / "metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2, sort_keys=True) + "\n")

    inventory_path = RAW_DIR / "inventory.csv"
    with inventory_path.open("w", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "source_key",
                "path",
                "filename",
                "bytes",
                "sha256",
                "source_url",
                "member_count",
                "uncompressed_bytes",
                "last_modified",
                "etag",
                "retrieved_at",
            ],
        )
        writer.writeheader()
        for record in records:
            http = record["http"]
            zip_summary = record["zip"]
            assert isinstance(http, dict)
            assert isinstance(zip_summary, dict)
            headers = http.get("headers", {})
            assert isinstance(headers, dict)
            writer.writerow(
                {
                    "source_key": record["source_key"],
                    "path": record["path"],
                    "filename": record["filename"],
                    "bytes": record["bytes"],
                    "sha256": record["sha256"],
                    "source_url": record["source_url"],
                    "member_count": zip_summary.get("member_count"),
                    "uncompressed_bytes": zip_summary.get("uncompressed_bytes"),
                    "last_modified": headers.get("Last-Modified"),
                    "etag": headers.get("ETag"),
                    "retrieved_at": record["retrieved_at"],
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
        "file_count": len(records),
        "total_bytes": metadata["total_bytes"],
        "total_uncompressed_bytes": metadata["total_uncompressed_bytes"],
        "records": [
            {
                "source_key": record["source_key"],
                "filename": record["filename"],
                "bytes": record["bytes"],
                "sha256": record["sha256"],
                "member_count": record["zip"]["member_count"],
                "uncompressed_bytes": record["zip"]["uncompressed_bytes"],
            }
            for record in records
        ],
        "manifest": manifest_result,
    }


@app.local_entrypoint()
def main() -> None:
    print(json.dumps(add_eia_electricity_survey_detail.remote(), indent=2, sort_keys=True))

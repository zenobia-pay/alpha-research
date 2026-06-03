"""Direct Modal-volume addition for Census government-finance historical files."""

from __future__ import annotations

import csv
import hashlib
import json
import shutil
import subprocess
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import modal


APP_NAME = "econ-direct-census-gov-finances-historical"
BASE_URL = "https://www2.census.gov/programs-surveys/gov-finances/tables"
DATASET_ROOT = Path("/data/datasets/econ")
RAW_DIR = DATASET_ROOT / "raw" / "census_gov_finances_historical_2017_2022_20260603"

app = modal.App(APP_NAME)
volume = modal.Volume.from_name("agent-dataset")
image = modal.Image.debian_slim().apt_install("curl")


def _file_specs() -> list[dict[str, object]]:
    specs: list[dict[str, object]] = []
    for year in range(2022, 2016, -1):
        specs.append(
            {
                "year": year,
                "role": f"{year} individual unit public-use ZIP",
                "url": f"{BASE_URL}/{year}/{year}_Individual_Unit_File.zip",
                "filename": f"{year}_Individual_Unit_File.zip",
                "required": True,
            }
        )
    for year in [2022, 2021, 2020, 2019]:
        specs.append(
            {
                "year": year,
                "role": f"{year} methodology PDF",
                "url": f"{BASE_URL}/{year}/{year}_methodology.pdf",
                "filename": f"{year}_methodology.pdf",
                "required": False,
            }
        )
    return specs


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _download(url: str, destination: Path) -> dict[str, str]:
    header_path = destination.with_suffix(destination.suffix + ".headers")
    subprocess.run(
        [
            "curl",
            "--fail",
            "--location",
            "--max-time",
            "180",
            "--retry",
            "2",
            "--retry-delay",
            "2",
            "--silent",
            "--show-error",
            "--dump-header",
            str(header_path),
            "--output",
            str(destination),
            url,
        ],
        check=True,
    )
    headers = header_path.read_text(encoding="utf-8", errors="replace")
    header_path.unlink()
    response: dict[str, str] = {}
    for line in headers.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        normalized = key.strip().lower()
        if normalized in {"content-type", "content-length", "last-modified", "etag"}:
            response[normalized.replace("-", "_")] = value.strip()
    return response


def _inspect(path: Path) -> dict[str, object]:
    if path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path) as archive:
            bad_member = archive.testzip()
            if bad_member:
                raise RuntimeError(f"{path.name} failed ZIP integrity at {bad_member}")
            members = archive.infolist()
            row_counts: list[dict[str, object]] = []
            for member in members:
                if member.filename.lower().endswith((".txt", ".csv", ".dat")):
                    with archive.open(member) as handle:
                        row_count = sum(1 for _line in handle)
                    row_counts.append(
                        {
                            "member": member.filename,
                            "rows": row_count,
                            "uncompressed_bytes": member.file_size,
                        }
                    )
            return {
                "member_count": len(members),
                "member_names": [member.filename for member in members],
                "uncompressed_bytes": sum(member.file_size for member in members),
                "row_counts": row_counts,
            }
    if path.suffix.lower() == ".pdf":
        if not path.read_bytes()[:4].startswith(b"%PDF"):
            raise RuntimeError(f"{path.name} is not a PDF")
    return {}


def _upsert_manifest(entries: list[dict[str, object]]) -> dict[str, object]:
    manifest_path = DATASET_ROOT / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    existing = {
        entry.get("path"): entry
        for entry in manifest.get("entries", [])
        if entry.get("source_key") != "census_gov_finances_historical_2017_2022"
    }
    for entry in entries:
        existing[entry["path"]] = entry
    manifest["entries"] = sorted(existing.values(), key=lambda entry: str(entry.get("path", "")))
    manifest["generated_at"] = datetime.now(timezone.utc).isoformat()
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")
    return {"manifest_path": "manifest.json", "entry_count": len(manifest["entries"])}


@app.function(image=image, volumes={"/data": volume}, timeout=7200)
def add_census_gov_finances_historical() -> dict[str, object]:
    if not DATASET_ROOT.exists():
        raise RuntimeError(f"Dataset root missing: {DATASET_ROOT}")
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    shutil.rmtree(RAW_DIR)
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    retrieved_at = datetime.now(timezone.utc).isoformat()
    records: list[dict[str, object]] = []
    failures: list[dict[str, object]] = []

    for spec in _file_specs():
        path = RAW_DIR / str(spec["filename"])
        try:
            response = _download(str(spec["url"]), path)
            inspection = _inspect(path)
        except Exception as exc:
            failures.append({**spec, "error": str(exc)})
            if spec["required"]:
                raise
            continue
        records.append(
            {
                "year": spec["year"],
                "role": spec["role"],
                "path": str(path.relative_to(DATASET_ROOT)),
                "filename": path.name,
                "bytes": path.stat().st_size,
                "sha256": _sha256(path),
                "source_url": spec["url"],
                "retrieved_at": retrieved_at,
                "response": response,
                "inspection": inspection,
            }
        )

    metadata = {
        "dataset_id": "econ",
        "source_key": "census_gov_finances_historical_2017_2022",
        "title": "Census Annual Survey of State and Local Government Finances historical individual-unit public-use files, 2017-2022",
        "retrieved_at": retrieved_at,
        "raw_dir": str(RAW_DIR.relative_to(DATASET_ROOT)),
        "file_count": len(records),
        "total_bytes": sum(int(record["bytes"]) for record in records),
        "records": records,
        "download_failures": failures,
        "notes": [
            "Provider-native Census public-use ZIPs are retained as published.",
            "Methodology PDFs are retained where the official endpoint responded during capture.",
        ],
    }
    metadata_path = RAW_DIR / "metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2, sort_keys=True) + "\n")

    inventory_path = RAW_DIR / "inventory.csv"
    with inventory_path.open("w", newline="") as handle:
        fieldnames = [
            "year",
            "role",
            "filename",
            "path",
            "bytes",
            "sha256",
            "source_url",
            "retrieved_at",
            "content_type",
            "last_modified",
            "member_count",
            "uncompressed_bytes",
            "row_count_summary",
        ]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for record in records:
            response = record["response"]
            inspection = record["inspection"]
            assert isinstance(response, dict)
            assert isinstance(inspection, dict)
            writer.writerow(
                {
                    "year": record["year"],
                    "role": record["role"],
                    "filename": record["filename"],
                    "path": record["path"],
                    "bytes": record["bytes"],
                    "sha256": record["sha256"],
                    "source_url": record["source_url"],
                    "retrieved_at": record["retrieved_at"],
                    "content_type": response.get("content_type"),
                    "last_modified": response.get("last_modified"),
                    "member_count": inspection.get("member_count"),
                    "uncompressed_bytes": inspection.get("uncompressed_bytes"),
                    "row_count_summary": json.dumps(inspection.get("row_counts", []), sort_keys=True),
                }
            )

    manifest_entries = [
        {
            "path": record["path"],
            "bytes": record["bytes"],
            "sha256": record["sha256"],
            "source_url": record["source_url"],
            "source_key": "census_gov_finances_historical_2017_2022",
            "retrieved_at": retrieved_at,
        }
        for record in records
    ]
    for path in [metadata_path, inventory_path]:
        manifest_entries.append(
            {
                "path": str(path.relative_to(DATASET_ROOT)),
                "bytes": path.stat().st_size,
                "sha256": _sha256(path),
                "source_url": BASE_URL,
                "source_key": "census_gov_finances_historical_2017_2022",
                "retrieved_at": retrieved_at,
            }
        )
    manifest_update = _upsert_manifest(manifest_entries)
    volume.commit()

    return {
        "raw_dir": str(RAW_DIR.relative_to(DATASET_ROOT)),
        "file_count": len(records),
        "total_bytes": metadata["total_bytes"],
        "manifest": manifest_update,
    }


if __name__ == "__main__":
    print(json.dumps(add_census_gov_finances_historical.remote(), indent=2, sort_keys=True))

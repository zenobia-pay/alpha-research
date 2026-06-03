"""Direct Modal-volume addition for TreasuryDirect auction history feeds."""

from __future__ import annotations

import csv
import hashlib
import json
import shutil
import ssl
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

import modal


APP_NAME = "econ-direct-treasurydirect-auctions"
BASE_URL = "https://www.treasurydirect.gov"
DATASET_ROOT = Path("/data/datasets/econ")
RAW_DIR = DATASET_ROOT / "raw" / "treasurydirect_auctions_20260603"

app = modal.App(APP_NAME)
volume = modal.Volume.from_name("agent-dataset")
image = modal.Image.debian_slim()

FEEDS = [
    {
        "role": "TreasuryDirect securities search history JSON",
        "url": f"{BASE_URL}/TA_WS/securities/search?format=json",
        "filename": "securities_search_all.json",
    },
    {
        "role": "TreasuryDirect auctioned securities recent JSON",
        "url": f"{BASE_URL}/TA_WS/securities/auctioned?format=json",
        "filename": "securities_auctioned_recent.json",
    },
    {
        "role": "TreasuryDirect announced securities JSON",
        "url": f"{BASE_URL}/TA_WS/securities/announced?format=json",
        "filename": "securities_announced.json",
    },
    {
        "role": "TreasuryDirect upcoming securities JSON",
        "url": f"{BASE_URL}/TA_WS/securities/upcoming?format=json",
        "filename": "securities_upcoming.json",
    },
]


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _download(url: str, destination: Path) -> dict[str, str | None]:
    request = Request(url, headers={"User-Agent": "alpha-research-canonical-direct/1.0"})
    context = ssl._create_unverified_context()
    with urlopen(request, timeout=300, context=context) as response:
        content_type = response.headers.get("Content-Type")
        last_modified = response.headers.get("Last-Modified")
        etag = response.headers.get("ETag")
        with destination.open("wb") as handle:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                handle.write(chunk)
    return {
        "content_type": content_type,
        "last_modified": last_modified,
        "etag": etag,
    }


def _inspect_json(path: Path) -> dict[str, object]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise RuntimeError(f"{path.name} is not a JSON array")
    if not data:
        return {"record_count": 0, "field_count": 0, "fields": []}
    if not all(isinstance(record, dict) for record in data):
        raise RuntimeError(f"{path.name} contains non-object records")

    fields = sorted({field for record in data for field in record})
    auction_dates = sorted(
        str(record.get("auctionDate"))
        for record in data
        if isinstance(record.get("auctionDate"), str) and record.get("auctionDate")
    )
    security_types = sorted({str(record.get("securityType")) for record in data if record.get("securityType")})
    xml_field_counts = {
        field: sum(1 for record in data if record.get(field))
        for field in [
            "xmlFilenameAnnouncement",
            "xmlFilenameCompetitiveResults",
            "xmlFilenameSpecialAnnouncement",
        ]
    }
    return {
        "record_count": len(data),
        "field_count": len(fields),
        "fields": fields,
        "security_types": security_types,
        "min_auction_date": auction_dates[0] if auction_dates else None,
        "max_auction_date": auction_dates[-1] if auction_dates else None,
        "xml_field_counts": xml_field_counts,
    }


def _write_csv_projection(json_path: Path, csv_path: Path) -> dict[str, object]:
    data = json.loads(json_path.read_text(encoding="utf-8"))
    fields = sorted({field for record in data for field in record})
    with csv_path.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(data)
    return {
        "record_count": len(data),
        "field_count": len(fields),
        "fields": fields,
    }


def _upsert_manifest(entries: list[dict[str, object]]) -> dict[str, object]:
    manifest_path = DATASET_ROOT / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    existing = {
        entry.get("path"): entry
        for entry in manifest.get("entries", [])
        if entry.get("source_key") != "treasurydirect_auctions"
    }
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
def add_treasurydirect_auctions() -> dict[str, object]:
    if not DATASET_ROOT.exists():
        raise RuntimeError(f"Dataset root missing: {DATASET_ROOT}")

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    probe = RAW_DIR / ".write_probe"
    probe.write_text("ok\n")
    probe.unlink()
    shutil.rmtree(RAW_DIR)
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    retrieved_at = datetime.now(timezone.utc).isoformat()
    records: list[dict[str, object]] = []

    for feed in FEEDS:
        path = RAW_DIR / str(feed["filename"])
        response = _download(str(feed["url"]), path)
        inspection = _inspect_json(path)
        records.append(
            {
                "role": feed["role"],
                "path": str(path.relative_to(DATASET_ROOT)),
                "filename": path.name,
                "bytes": path.stat().st_size,
                "sha256": _sha256(path),
                "source_url": feed["url"],
                "retrieved_at": retrieved_at,
                "response": response,
                "inspection": inspection,
            }
        )

    projection_path = RAW_DIR / "securities_search_all.csv"
    projection_inspection = _write_csv_projection(RAW_DIR / "securities_search_all.json", projection_path)
    records.append(
        {
            "role": "CSV projection of TreasuryDirect securities search history JSON",
            "path": str(projection_path.relative_to(DATASET_ROOT)),
            "filename": projection_path.name,
            "bytes": projection_path.stat().st_size,
            "sha256": _sha256(projection_path),
            "source_url": f"{BASE_URL}/TA_WS/securities/search?format=json",
            "retrieved_at": retrieved_at,
            "response": {"content_type": "text/csv; derived from provider JSON"},
            "inspection": projection_inspection,
        }
    )

    metadata = {
        "dataset_id": "econ",
        "source_key": "treasurydirect_auctions",
        "title": "TreasuryDirect auction history and securities feeds",
        "retrieved_at": retrieved_at,
        "raw_dir": str(RAW_DIR.relative_to(DATASET_ROOT)),
        "file_count": len(records),
        "total_bytes": sum(int(record["bytes"]) for record in records),
        "records": records,
        "notes": [
            "TreasuryDirect TA_WS JSON feeds are retained provider-native.",
            "The all-securities search feed carries historical Treasury auction fields plus XML/PDF announcement and results filenames.",
            "The CSV file is a local projection of the provider JSON for inspection; provider JSON remains the source of truth.",
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
                "role",
                "filename",
                "path",
                "bytes",
                "sha256",
                "source_url",
                "retrieved_at",
                "content_type",
                "record_count",
                "field_count",
                "min_auction_date",
                "max_auction_date",
                "xml_filename_announcement_count",
                "xml_filename_competitive_results_count",
                "xml_filename_special_announcement_count",
            ],
        )
        writer.writeheader()
        for record in records:
            response = record["response"]
            inspection = record["inspection"]
            assert isinstance(response, dict)
            assert isinstance(inspection, dict)
            xml_counts = inspection.get("xml_field_counts") or {}
            assert isinstance(xml_counts, dict)
            writer.writerow(
                {
                    "role": record["role"],
                    "filename": record["filename"],
                    "path": record["path"],
                    "bytes": record["bytes"],
                    "sha256": record["sha256"],
                    "source_url": record["source_url"],
                    "retrieved_at": record["retrieved_at"],
                    "content_type": response.get("content_type"),
                    "record_count": inspection.get("record_count"),
                    "field_count": inspection.get("field_count"),
                    "min_auction_date": inspection.get("min_auction_date"),
                    "max_auction_date": inspection.get("max_auction_date"),
                    "xml_filename_announcement_count": xml_counts.get("xmlFilenameAnnouncement"),
                    "xml_filename_competitive_results_count": xml_counts.get("xmlFilenameCompetitiveResults"),
                    "xml_filename_special_announcement_count": xml_counts.get("xmlFilenameSpecialAnnouncement"),
                }
            )

    manifest_entries = [
        {
            "path": record["path"],
            "bytes": record["bytes"],
            "sha256": record["sha256"],
            "source_url": record["source_url"],
            "source_key": "treasurydirect_auctions",
            "retrieved_at": retrieved_at,
        }
        for record in records
    ]
    manifest_entries.extend(
        [
            {
                "path": str(metadata_path.relative_to(DATASET_ROOT)),
                "bytes": metadata_path.stat().st_size,
                "sha256": _sha256(metadata_path),
                "source_url": BASE_URL,
                "source_key": "treasurydirect_auctions",
                "retrieved_at": retrieved_at,
            },
            {
                "path": str(inventory_path.relative_to(DATASET_ROOT)),
                "bytes": inventory_path.stat().st_size,
                "sha256": _sha256(inventory_path),
                "source_url": BASE_URL,
                "source_key": "treasurydirect_auctions",
                "retrieved_at": retrieved_at,
            },
        ]
    )
    manifest_update = _upsert_manifest(manifest_entries)
    volume.commit()

    return {
        "raw_dir": str(RAW_DIR.relative_to(DATASET_ROOT)),
        "file_count": len(records),
        "total_bytes": metadata["total_bytes"],
        "records": [
            {
                "filename": record["filename"],
                "bytes": record["bytes"],
                "sha256": record["sha256"],
                "inspection": record["inspection"],
            }
            for record in records
        ],
        "manifest": manifest_update,
    }


if __name__ == "__main__":
    print(json.dumps(add_treasurydirect_auctions.remote(), indent=2, sort_keys=True))

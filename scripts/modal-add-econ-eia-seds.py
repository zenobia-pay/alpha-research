"""Direct Modal-volume addition for econ EIA SEDS bulk data.

This intentionally bypasses remote Codex workers. It runs in Modal with the
canonical dataset volume mounted, downloads a public EIA bulk ZIP, records
provenance, and updates the mounted manifest.
"""

from __future__ import annotations

import csv
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

import modal


APP_NAME = "econ-direct-eia-seds"
DATASET_ROOT = Path("/data/datasets/econ")
RAW_DIR = DATASET_ROOT / "raw" / "eia_open_data_seds_20260522"
SOURCE_URL = "https://www.eia.gov/opendata/bulk/SEDS.zip"

app = modal.App(APP_NAME)
volume = modal.Volume.from_name("agent-dataset")
image = modal.Image.debian_slim()


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _download(url: str, destination: Path) -> dict[str, object]:
    request = Request(url, headers={"User-Agent": "alpha-research-canonical-direct/1.0"})
    with urlopen(request, timeout=120) as response:
        destination.write_bytes(response.read())
        return {
            "url": url,
            "status": getattr(response, "status", None),
            "content_type": response.headers.get("Content-Type"),
            "last_modified": response.headers.get("Last-Modified"),
            "etag": response.headers.get("ETag"),
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


@app.function(image=image, volumes={"/data": volume}, timeout=900)
def add_eia_seds() -> dict[str, object]:
    if not DATASET_ROOT.exists():
        raise RuntimeError(f"Dataset root missing: {DATASET_ROOT}")

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    probe = RAW_DIR / ".write_probe"
    probe.write_text("ok\n")
    probe.unlink()

    retrieved_at = datetime.now(timezone.utc).isoformat()
    zip_path = RAW_DIR / "SEDS.zip"
    response_meta = _download(SOURCE_URL, zip_path)

    zip_entry = {
        "path": str(zip_path.relative_to(DATASET_ROOT)),
        "bytes": zip_path.stat().st_size,
        "sha256": _sha256(zip_path),
        "source_url": SOURCE_URL,
        "source_key": "eia_open_data_seds",
        "retrieved_at": retrieved_at,
    }

    source_record = {
        "dataset_id": "econ",
        "source_key": "eia_open_data_seds",
        "title": "U.S. Energy Information Administration State Energy Data System bulk ZIP",
        "url": SOURCE_URL,
        "retrieved_at": retrieved_at,
        "storage_path": zip_entry["path"],
        "bytes": zip_entry["bytes"],
        "sha256": zip_entry["sha256"],
        "response": response_meta,
        "notes": [
            "Public EIA Open Data bulk package for State Energy Data System series.",
            "Adds machine-readable state energy quantity, price, expenditure, and consumption coverage.",
            "Downloaded directly in Modal against the mounted agent-dataset volume; no remote Codex worker was used.",
        ],
    }

    metadata_path = RAW_DIR / "metadata.json"
    metadata_path.write_text(json.dumps(source_record, indent=2, sort_keys=True) + "\n")

    inventory_path = RAW_DIR / "inventory.csv"
    with inventory_path.open("w", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["path", "bytes", "sha256", "source_url", "retrieved_at"],
        )
        writer.writeheader()
        writer.writerow(
            {
                "path": zip_entry["path"],
                "bytes": zip_entry["bytes"],
                "sha256": zip_entry["sha256"],
                "source_url": SOURCE_URL,
                "retrieved_at": retrieved_at,
            }
        )

    metadata_entry = {
        "path": str(metadata_path.relative_to(DATASET_ROOT)),
        "bytes": metadata_path.stat().st_size,
        "sha256": _sha256(metadata_path),
    }
    inventory_entry = {
        "path": str(inventory_path.relative_to(DATASET_ROOT)),
        "bytes": inventory_path.stat().st_size,
        "sha256": _sha256(inventory_path),
    }
    manifest_result = _upsert_manifest([zip_entry, metadata_entry, inventory_entry])
    volume.commit()

    return {
        "status": "ok",
        "app": APP_NAME,
        "raw_dir": str(RAW_DIR.relative_to(DATASET_ROOT)),
        "retrieved_at": retrieved_at,
        "download": response_meta,
        "zip": zip_entry,
        "manifest": manifest_result,
    }


@app.local_entrypoint()
def main() -> None:
    print(json.dumps(add_eia_seds.remote(), indent=2, sort_keys=True))

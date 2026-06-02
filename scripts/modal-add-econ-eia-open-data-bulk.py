"""Direct Modal-volume addition for broader econ EIA Open Data bulk archives."""

from __future__ import annotations

import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

import modal


APP_NAME = "econ-direct-eia-open-data-bulk"
DATASET_ROOT = Path("/data/datasets/econ")
RAW_DIR = DATASET_ROOT / "raw" / "eia_open_data_bulk_20260602"
PACKAGES = [
    {
        "key": "eia_open_data_electric_power",
        "filename": "ELEC.zip",
        "url": "https://www.eia.gov/opendata/bulk/ELEC.zip",
        "description": "Electric power series for generation, retail sales, prices, fuel use, capacity, and related electricity-market measures.",
    },
    {
        "key": "eia_open_data_petroleum",
        "filename": "PET.zip",
        "url": "https://www.eia.gov/opendata/bulk/PET.zip",
        "description": "Petroleum series for prices, stocks, supply, demand, refinery, imports, exports, and product-market measures.",
    },
    {
        "key": "eia_open_data_natural_gas",
        "filename": "NG.zip",
        "url": "https://www.eia.gov/opendata/bulk/NG.zip",
        "description": "Natural gas series for production, consumption, storage, prices, pipelines, imports, exports, and state/market measures.",
    },
    {
        "key": "eia_open_data_coal",
        "filename": "COAL.zip",
        "url": "https://www.eia.gov/opendata/bulk/COAL.zip",
        "description": "Coal series for production, consumption, stocks, trade, mining, and fuel-market measures.",
    },
    {
        "key": "eia_open_data_international",
        "filename": "INTL.zip",
        "url": "https://www.eia.gov/opendata/bulk/INTL.zip",
        "description": "International energy series for country-level energy production, consumption, reserves, trade, and prices where published.",
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


def _download(package: dict[str, str], destination: Path) -> dict[str, object]:
    request = Request(package["url"], headers={"User-Agent": "alpha-research-canonical-direct/1.0"})
    with urlopen(request, timeout=240) as response:
        with destination.open("wb") as handle:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                handle.write(chunk)
        return {
            "url": package["url"],
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


@app.function(image=image, volumes={"/data": volume}, timeout=1800)
def add_eia_open_data_bulk() -> dict[str, object]:
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
        response_meta = _download(package, output_path)
        record = {
            "source_key": package["key"],
            "path": str(output_path.relative_to(DATASET_ROOT)),
            "filename": package["filename"],
            "bytes": output_path.stat().st_size,
            "sha256": _sha256(output_path),
            "source_url": package["url"],
            "retrieved_at": retrieved_at,
            "description": package["description"],
            "response": response_meta,
        }
        records.append(record)
        manifest_entries.append(record.copy())

    metadata = {
        "dataset_id": "econ",
        "source_key": "eia_open_data_bulk",
        "title": "U.S. Energy Information Administration Open Data bulk archives",
        "retrieved_at": retrieved_at,
        "raw_dir": str(RAW_DIR.relative_to(DATASET_ROOT)),
        "records": records,
        "notes": [
            "Provider-native EIA Open Data bulk ZIP archives retained compressed to limit inode pressure.",
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
                "source_key",
                "path",
                "bytes",
                "sha256",
                "source_url",
                "retrieved_at",
                "last_modified",
                "etag",
            ],
        )
        writer.writeheader()
        for record in records:
            response = record["response"]
            assert isinstance(response, dict)
            writer.writerow(
                {
                    "source_key": record["source_key"],
                    "path": record["path"],
                    "bytes": record["bytes"],
                    "sha256": record["sha256"],
                    "source_url": record["source_url"],
                    "retrieved_at": record["retrieved_at"],
                    "last_modified": response.get("last_modified"),
                    "etag": response.get("etag"),
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
    print(json.dumps(add_eia_open_data_bulk.remote(), indent=2, sort_keys=True))

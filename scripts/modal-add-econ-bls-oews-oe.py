"""Modal-volume finalizer for BLS Occupational Employment and Wage Statistics files."""

from __future__ import annotations

import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import modal


APP_NAME = "econ-finalize-bls-oews-oe"
DATASET_ROOT = Path("/data/datasets/econ")
RAW_DIR = DATASET_ROOT / "raw" / "bls_oews_oe_20260521"
SOURCE_DIR = "https://downloadt.bls.gov/pub/time.series/oe/"

FILES = [
    "oe.area",
    "oe.areatype",
    "oe.contacts",
    "oe.data.0.Current",
    "oe.data.1.AllData",
    "oe.datatype",
    "oe.date",
    "oe.footnote",
    "oe.industry",
    "oe.occugroup",
    "oe.occupation",
    "oe.period",
    "oe.release",
    "oe.seasonal",
    "oe.sector",
    "oe.series",
    "oe.statemsa",
    "oe.txt",
    "oe.year",
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


def _text_summary(path: Path) -> dict[str, object]:
    line_count = 0
    first_line = ""
    with path.open("rb") as handle:
        for raw_line in handle:
            line_count += 1
            if not first_line:
                first_line = raw_line.decode("utf-8", errors="replace").strip()
    lowered = first_line.lower()
    if "<html" in lowered or "access denied" in lowered:
        raise RuntimeError(f"BLS file {path.name} looks like an HTML/error payload")
    field_count = len(next(csv.reader([first_line], delimiter="\t"))) if first_line else 0
    return {
        "line_count": line_count,
        "data_rows": max(0, line_count - 1),
        "field_count": field_count,
        "first_line": first_line,
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
def finalize_bls_oews_oe() -> dict[str, object]:
    if not DATASET_ROOT.exists():
        raise RuntimeError(f"Dataset root missing: {DATASET_ROOT}")
    if not RAW_DIR.exists():
        raise RuntimeError(f"Raw directory missing: {RAW_DIR}")

    retrieved_at = datetime.now(timezone.utc).isoformat()
    records: list[dict[str, object]] = []
    manifest_entries: list[dict[str, object]] = []
    for filename in FILES:
        output_path = RAW_DIR / filename
        if not output_path.exists():
            raise RuntimeError(f"Expected uploaded file missing: {output_path}")
        summary = _text_summary(output_path)
        record = {
            "source_key": "bls_oews_oe",
            "path": str(output_path.relative_to(DATASET_ROOT)),
            "filename": filename,
            "bytes": output_path.stat().st_size,
            "sha256": _sha256(output_path),
            "source_url": urljoin(SOURCE_DIR, filename),
            "retrieved_at": retrieved_at,
            "text": summary,
        }
        records.append(record)
        manifest_entries.append(
            {
                "path": record["path"],
                "bytes": record["bytes"],
                "sha256": record["sha256"],
                "source_url": record["source_url"],
                "source_key": "bls_oews_oe",
                "retrieved_at": retrieved_at,
            }
        )

    metadata = {
        "dataset_id": "econ",
        "source_key": "bls_oews_oe",
        "title": "Bureau of Labor Statistics Occupational Employment and Wage Statistics time-series files",
        "source_dir": SOURCE_DIR,
        "retrieved_at": retrieved_at,
        "raw_dir": str(RAW_DIR.relative_to(DATASET_ROOT)),
        "file_count": len(records),
        "total_bytes": sum(int(record["bytes"]) for record in records),
        "total_lines": sum(int(record["text"]["line_count"]) for record in records),
        "file_roster_source": "Official BLS directory listing observed at https://downloadt.bls.gov/pub/time.series/oe/ on 2026-06-03; files were downloaded locally from explicit official URLs, uploaded with modal volume put, and finalized on the mounted volume.",
        "records": records,
        "notes": [
            "Provider-native BLS OEWS flat files retained with original tab-delimited layouts.",
            "Validated on the mounted agent-dataset volume after local official-source download and Modal volume upload; no remote Codex worker was used.",
            "The package includes current and all-data observations plus area, area type, data type, date, footnote, industry, occupation group, occupation, period, release, seasonal, sector, series, state/MSA, year, contacts, and documentation files.",
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
                "line_count",
                "data_rows",
                "field_count",
                "retrieved_at",
            ],
        )
        writer.writeheader()
        for record in records:
            text = record["text"]
            assert isinstance(text, dict)
            writer.writerow(
                {
                    "filename": record["filename"],
                    "path": record["path"],
                    "bytes": record["bytes"],
                    "sha256": record["sha256"],
                    "source_url": record["source_url"],
                    "line_count": text.get("line_count"),
                    "data_rows": text.get("data_rows"),
                    "field_count": text.get("field_count"),
                    "retrieved_at": record["retrieved_at"],
                }
            )

    manifest_entries.extend(
        [
            {
                "path": str(metadata_path.relative_to(DATASET_ROOT)),
                "bytes": metadata_path.stat().st_size,
                "sha256": _sha256(metadata_path),
                "source_key": "bls_oews_oe",
                "retrieved_at": retrieved_at,
            },
            {
                "path": str(inventory_path.relative_to(DATASET_ROOT)),
                "bytes": inventory_path.stat().st_size,
                "sha256": _sha256(inventory_path),
                "source_key": "bls_oews_oe",
                "retrieved_at": retrieved_at,
            },
        ]
    )
    manifest_result = _upsert_manifest(manifest_entries)
    volume.commit()

    largest = sorted(records, key=lambda record: int(record["bytes"]), reverse=True)[:5]
    return {
        "status": "ok",
        "app": APP_NAME,
        "raw_dir": str(RAW_DIR.relative_to(DATASET_ROOT)),
        "retrieved_at": retrieved_at,
        "file_count": len(records),
        "total_bytes": metadata["total_bytes"],
        "total_lines": metadata["total_lines"],
        "largest_files": [
            {
                "filename": record["filename"],
                "bytes": record["bytes"],
                "sha256": record["sha256"],
                "line_count": record["text"]["line_count"],
                "data_rows": record["text"]["data_rows"],
            }
            for record in largest
        ],
        "manifest": manifest_result,
    }


@app.local_entrypoint()
def main() -> None:
    print(json.dumps(finalize_bls_oews_oe.remote(), indent=2, sort_keys=True))

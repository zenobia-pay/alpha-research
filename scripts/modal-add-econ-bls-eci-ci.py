"""Finalize locally uploaded BLS ECI/NCS `ci` files on the Modal volume."""

from __future__ import annotations

import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import modal


APP_NAME = "econ-finalize-bls-eci-ci"
DATASET_ROOT = Path("/data/datasets/econ")
RAW_DIR = DATASET_ROOT / "raw" / "bls_eci_ci_20260501"
SOURCE_DIR = "https://downloadt.bls.gov/pub/time.series/ci/"
FILES = [
    "ci.area",
    "ci.aspect",
    "ci.contacts",
    "ci.data.0.Current",
    "ci.data.1.AllData",
    "ci.estimate",
    "ci.footnote",
    "ci.industry",
    "ci.occupation",
    "ci.owner",
    "ci.periodicity",
    "ci.series",
    "ci.subcell",
    "ci.txt",
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


def _text_summary(path: Path) -> dict[str, object]:
    line_count = 0
    first_line = ""
    with path.open("rb") as handle:
        for raw_line in handle:
            line_count += 1
            if not first_line:
                first_line = raw_line.decode("utf-8", errors="replace").strip()
    if "<html" in first_line.lower() or "access denied" in first_line.lower():
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


@app.function(image=image, volumes={"/data": volume}, timeout=1800)
def finalize_bls_eci_ci() -> dict[str, object]:
    if not DATASET_ROOT.exists():
        raise RuntimeError(f"Dataset root missing: {DATASET_ROOT}")
    if not RAW_DIR.exists():
        raise RuntimeError(f"Upload directory missing: {RAW_DIR}")

    metadata_path = RAW_DIR / "metadata.json"
    inventory_path = RAW_DIR / "inventory.csv"
    if not metadata_path.exists() or not inventory_path.exists():
        raise RuntimeError("Upload is missing metadata.json or inventory.csv")

    uploaded_metadata = json.loads(metadata_path.read_text())
    expected_by_name = {record["filename"]: record for record in uploaded_metadata["records"]}

    records: list[dict[str, object]] = []
    manifest_entries: list[dict[str, object]] = []
    for filename in FILES:
        output_path = RAW_DIR / filename
        if not output_path.exists():
            raise RuntimeError(f"Uploaded BLS file missing: {filename}")
        summary = _text_summary(output_path)
        record = {
            "source_key": "bls_eci_ci",
            "path": str(output_path.relative_to(DATASET_ROOT)),
            "filename": filename,
            "bytes": output_path.stat().st_size,
            "sha256": _sha256(output_path),
            "source_url": f"{SOURCE_DIR}{filename}",
            "retrieved_at": uploaded_metadata["retrieved_at"],
            "text": summary,
        }
        expected = expected_by_name[filename]
        if record["bytes"] != expected["bytes"] or record["sha256"] != expected["sha256"]:
            raise RuntimeError(f"Uploaded file changed unexpectedly: {filename}")
        records.append(record)
        manifest_entries.append(
            {
                "path": record["path"],
                "bytes": record["bytes"],
                "sha256": record["sha256"],
                "source_url": record["source_url"],
                "source_key": "bls_eci_ci",
                "retrieved_at": record["retrieved_at"],
            }
        )

    for sidecar_path in [metadata_path, inventory_path]:
        manifest_entries.append(
            {
                "path": str(sidecar_path.relative_to(DATASET_ROOT)),
                "bytes": sidecar_path.stat().st_size,
                "sha256": _sha256(sidecar_path),
                "source_key": "bls_eci_ci",
                "retrieved_at": uploaded_metadata["retrieved_at"],
            }
        )

    manifest_result = _upsert_manifest(manifest_entries)
    volume.commit()

    largest = sorted(records, key=lambda record: int(record["bytes"]), reverse=True)[:5]
    return {
        "status": "ok",
        "app": APP_NAME,
        "raw_dir": str(RAW_DIR.relative_to(DATASET_ROOT)),
        "file_count": len(records),
        "total_bytes": sum(int(record["bytes"]) for record in records),
        "total_lines": sum(int(record["text"]["line_count"]) for record in records),
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
    print(json.dumps(finalize_bls_eci_ci.remote(), indent=2, sort_keys=True))

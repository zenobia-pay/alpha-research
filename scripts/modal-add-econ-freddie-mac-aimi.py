"""Direct Modal-volume addition for Freddie Mac Multifamily AIMI data."""

from __future__ import annotations

import csv
import hashlib
import json
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

import modal


APP_NAME = "econ-direct-freddie-mac-aimi"
BASE_URL = "https://mf.freddiemac.com"
DATASET_ROOT = Path("/data/datasets/econ")
RAW_DIR = DATASET_ROOT / "raw" / "freddie_mac_aimi_20260603"

app = modal.App(APP_NAME)
volume = modal.Volume.from_name("agent-dataset")
image = modal.Image.debian_slim()

FILES = [
    {
        "role": "AIMI raw chart data workbook",
        "url": f"{BASE_URL}/docs/aimi_raw_chart_data.xlsx",
        "filename": "aimi_raw_chart_data.xlsx",
    },
    {
        "role": "AIMI landing page HTML",
        "url": f"{BASE_URL}/aimi",
        "filename": "aimi.html",
    },
    {
        "role": "AIMI methodology page HTML",
        "url": f"{BASE_URL}/aimi/about",
        "filename": "aimi_about.html",
    },
    {
        "role": "AIMI FAQ page HTML",
        "url": f"{BASE_URL}/aimi/faq",
        "filename": "aimi_faq.html",
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
    with urlopen(request, timeout=300) as response:
        content_type = response.headers.get("Content-Type")
        disposition = response.headers.get("Content-Disposition")
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
        "content_disposition": disposition,
        "last_modified": last_modified,
        "etag": etag,
    }


def _inspect(path: Path) -> dict[str, object]:
    if path.suffix.lower() == ".xlsx":
        with zipfile.ZipFile(path) as workbook:
            bad_member = workbook.testzip()
            members = workbook.infolist()
            if bad_member:
                raise RuntimeError(f"{path.name} failed XLSX ZIP integrity at {bad_member}")
            names = [member.filename for member in members]
            if "[Content_Types].xml" not in names or not any(name.startswith("xl/worksheets/") for name in names):
                raise RuntimeError(f"{path.name} does not look like an XLSX workbook")
            return {
                "member_count": len(members),
                "worksheet_count": sum(name.startswith("xl/worksheets/") for name in names),
                "member_names": names[:40],
                "uncompressed_bytes": sum(member.file_size for member in members),
            }
    if path.suffix.lower() == ".html":
        text = path.read_text(encoding="utf-8", errors="replace")
        if "<html" not in text.lower():
            raise RuntimeError(f"{path.name} does not look like HTML")
        return {
            "line_count": text.count("\n") + 1,
            "contains_aimi": "aimi" in text.lower(),
        }
    return {}


def _upsert_manifest(entries: list[dict[str, object]]) -> dict[str, object]:
    manifest_path = DATASET_ROOT / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    existing = {
        entry.get("path"): entry
        for entry in manifest.get("entries", [])
        if entry.get("source_key") != "freddie_mac_aimi"
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
def add_freddie_mac_aimi() -> dict[str, object]:
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

    for spec in FILES:
        path = RAW_DIR / str(spec["filename"])
        response = _download(str(spec["url"]), path)
        inspection = _inspect(path)
        records.append(
            {
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
        "source_key": "freddie_mac_aimi",
        "title": "Freddie Mac Multifamily Apartment Investment Market Index raw chart data",
        "retrieved_at": retrieved_at,
        "raw_dir": str(RAW_DIR.relative_to(DATASET_ROOT)),
        "file_count": len(records),
        "total_bytes": sum(int(record["bytes"]) for record in records),
        "records": records,
        "notes": [
            "Provider-native Freddie Mac Multifamily AIMI raw chart workbook retained as published.",
            "AIMI landing, about, and FAQ pages are retained for source, methodology, and interpretation context.",
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
                "last_modified",
                "etag",
                "worksheet_count",
                "line_count",
                "uncompressed_bytes",
            ],
        )
        writer.writeheader()
        for record in records:
            response = record["response"]
            inspection = record["inspection"]
            assert isinstance(response, dict)
            assert isinstance(inspection, dict)
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
                    "last_modified": response.get("last_modified"),
                    "etag": response.get("etag"),
                    "worksheet_count": inspection.get("worksheet_count"),
                    "line_count": inspection.get("line_count"),
                    "uncompressed_bytes": inspection.get("uncompressed_bytes"),
                }
            )

    manifest_entries = [
        {
            "path": record["path"],
            "bytes": record["bytes"],
            "sha256": record["sha256"],
            "source_url": record["source_url"],
            "source_key": "freddie_mac_aimi",
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
                "source_key": "freddie_mac_aimi",
                "retrieved_at": retrieved_at,
            },
            {
                "path": str(inventory_path.relative_to(DATASET_ROOT)),
                "bytes": inventory_path.stat().st_size,
                "sha256": _sha256(inventory_path),
                "source_url": BASE_URL,
                "source_key": "freddie_mac_aimi",
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
        "records": records,
        "manifest": manifest_update,
    }


if __name__ == "__main__":
    print(json.dumps(add_freddie_mac_aimi.remote(), indent=2, sort_keys=True))

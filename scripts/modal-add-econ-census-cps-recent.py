"""Direct Modal-volume addition for recent Census CPS public-use microdata."""

from __future__ import annotations

import csv
import hashlib
import json
import socket
import time
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import modal


APP_NAME = "econ-direct-census-cps-recent"
SOURCE_ROOT = "https://www2.census.gov/programs-surveys/cps/datasets"
DATASET_ROOT = Path("/data/datasets/econ")
RAW_DIR = DATASET_ROOT / "raw" / "census_cps_recent_2025_2026"

app = modal.App(APP_NAME)
volume = modal.Volume.from_name("agent-dataset")
image = modal.Image.debian_slim()


FILES = [
    *[
        {
            "year": "2025",
            "collection": "basic",
            "filename": f"{month}25pub.zip",
            "role": "basic monthly public-use microdata",
        }
        for month in ("jan", "feb", "mar", "apr", "may", "jul", "aug", "nov", "dec")
    ],
    *[
        {
            "year": "2026",
            "collection": "basic",
            "filename": f"{month}26pub.zip",
            "role": "basic monthly public-use microdata",
        }
        for month in ("jan", "feb", "mar", "apr")
    ],
    {
        "year": "2025",
        "collection": "march",
        "filename": "asec2025_pubuse.zip",
        "role": "ASEC public-use ASCII package",
    },
    {
        "year": "2025",
        "collection": "march",
        "filename": "CPS_ASEC_ASCII_REPWGT_2025.ZIP",
        "role": "ASEC replicate weights",
    },
    {
        "year": "2025",
        "collection": "march",
        "filename": "famlfmt.txt",
        "role": "ASEC family format metadata",
    },
    {
        "year": "2025",
        "collection": "march",
        "filename": "hhldfmt.txt",
        "role": "ASEC household format metadata",
    },
    {
        "year": "2025",
        "collection": "march",
        "filename": "persfmt.txt",
        "role": "ASEC person format metadata",
    },
]


def _source_url(item: dict[str, str]) -> str:
    return f"{SOURCE_ROOT}/{item['year']}/{item['collection']}/{item['filename']}"


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _download(url: str, destination: Path) -> dict[str, object]:
    last_error = None
    for attempt in range(1, 5):
        try:
            request = Request(
                url,
                headers={
                    "User-Agent": "alpha-research-canonical-direct/1.0",
                    "Accept": "application/zip,application/pdf,text/plain,*/*",
                },
            )
            # Census occasionally leaves connections open after bad edge responses.
            with urlopen(request, timeout=90) as response:
                status = getattr(response, "status", None)
                content_type = response.headers.get("Content-Type")
                last_modified = response.headers.get("Last-Modified")
                with destination.open("wb") as handle:
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        handle.write(chunk)
                with destination.open("rb") as sample_handle:
                    sample_bytes = sample_handle.read(300)
                if destination.suffix.lower() == ".zip" and sample_bytes[:4] != b"PK\x03\x04":
                    sample = sample_bytes.decode("utf-8", errors="replace")
                    raise RuntimeError(f"non-ZIP response: {status} {content_type} {sample}")
                if destination.suffix.lower() == ".zip":
                    with zipfile.ZipFile(destination) as archive:
                        bad_member = archive.testzip()
                        if bad_member:
                            raise RuntimeError(f"ZIP integrity failed at {bad_member}")
                if destination.suffix.lower() == ".pdf" and not sample_bytes.startswith(b"%PDF"):
                    sample = sample_bytes.decode("utf-8", errors="replace")
                    raise RuntimeError(f"non-PDF response: {status} {content_type} {sample}")
                return {
                    "status": status,
                    "content_type": content_type,
                    "last_modified": last_modified,
                    "attempts": attempt,
                }
        except (HTTPError, URLError, TimeoutError, RuntimeError, socket.timeout, zipfile.BadZipFile) as error:
            last_error = repr(error)
            if destination.exists():
                destination.unlink()
            time.sleep(attempt * 3)
    raise RuntimeError(f"failed to download {url}: {last_error}")


def _inspect_file(path: Path) -> dict[str, object]:
    lower = path.name.lower()
    if lower.endswith(".zip"):
        with zipfile.ZipFile(path) as archive:
            bad_member = archive.testzip()
            members = archive.infolist()
            if bad_member:
                raise RuntimeError(f"{path.name} failed ZIP integrity at {bad_member}")
            return {
                "member_count": len(members),
                "member_names": [member.filename for member in members],
                "uncompressed_bytes": sum(member.file_size for member in members),
            }
    return {"member_count": None, "member_names": [], "uncompressed_bytes": None}


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
def add_census_cps_recent() -> dict[str, object]:
    if not DATASET_ROOT.exists():
        raise RuntimeError(f"Dataset root missing: {DATASET_ROOT}")

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    probe = RAW_DIR / ".write_probe"
    probe.write_text("ok\n")
    probe.unlink()

    retrieved_at = datetime.now(timezone.utc).isoformat()
    records: list[dict[str, object]] = []
    manifest_entries: list[dict[str, object]] = []

    for item in FILES:
        source_url = _source_url(item)
        destination = RAW_DIR / item["filename"]
        if destination.exists():
            try:
                inspection = _inspect_file(destination)
                print(f"using existing verified {item['filename']}", flush=True)
                response = {"status": "existing", "content_type": None, "last_modified": None, "attempts": 0}
            except (RuntimeError, zipfile.BadZipFile):
                destination.unlink()
                print(f"redownloading invalid existing {item['filename']} from {source_url}", flush=True)
                response = _download(source_url, destination)
                inspection = _inspect_file(destination)
        else:
            print(f"downloading {item['filename']} from {source_url}", flush=True)
            response = _download(source_url, destination)
            inspection = _inspect_file(destination)
        record = {
            "path": str(destination.relative_to(DATASET_ROOT)),
            "filename": item["filename"],
            "year": item["year"],
            "collection": item["collection"],
            "role": item["role"],
            "bytes": destination.stat().st_size,
            "sha256": _sha256(destination),
            "source_url": source_url,
            "retrieved_at": retrieved_at,
            "response": response,
            "inspection": inspection,
        }
        records.append(record)
        manifest_entries.append(
            {
                "path": record["path"],
                "bytes": record["bytes"],
                "sha256": record["sha256"],
                "source_url": record["source_url"],
                "source_key": "census_cps_recent",
                "retrieved_at": retrieved_at,
            }
        )

    metadata = {
        "dataset_id": "econ",
        "source_key": "census_cps_recent",
        "title": "Census CPS recent basic monthly and 2025 ASEC public-use microdata",
        "source_root": SOURCE_ROOT,
        "retrieved_at": retrieved_at,
        "raw_dir": str(RAW_DIR.relative_to(DATASET_ROOT)),
        "file_count": len(records),
        "total_bytes": sum(int(record["bytes"]) for record in records),
        "basic_monthly_periods": [
            f"{record['year']}/{record['filename']}"
            for record in records
            if record["collection"] == "basic"
        ],
        "asec_files": [
            record["filename"]
            for record in records
            if record["collection"] == "march"
        ],
        "records": records,
        "notes": [
            "Provider-native U.S. Census Bureau CPS public-use files retained as published.",
            "The package covers the successfully reachable named 2025 basic monthly files, 2026 January-April basic monthly files, and the 2025 ASEC public-use data/documentation files selected from the official Census CPS datasets directory.",
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
                "year",
                "collection",
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
                    "year": record["year"],
                    "collection": record["collection"],
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
                }
            )

    manifest_entries.extend(
        [
            {
                "path": str(metadata_path.relative_to(DATASET_ROOT)),
                "bytes": metadata_path.stat().st_size,
                "sha256": _sha256(metadata_path),
                "source_url": SOURCE_ROOT,
                "source_key": "census_cps_recent",
                "retrieved_at": retrieved_at,
            },
            {
                "path": str(inventory_path.relative_to(DATASET_ROOT)),
                "bytes": inventory_path.stat().st_size,
                "sha256": _sha256(inventory_path),
                "source_url": SOURCE_ROOT,
                "source_key": "census_cps_recent",
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
        "basic_file_count": len(metadata["basic_monthly_periods"]),
        "asec_file_count": len(metadata["asec_files"]),
        "largest_files": sorted(
            [
                {
                    "filename": record["filename"],
                    "bytes": record["bytes"],
                    "sha256": record["sha256"],
                    "member_count": record["inspection"].get("member_count") if isinstance(record["inspection"], dict) else None,
                }
                for record in records
            ],
            key=lambda record: int(record["bytes"]),
            reverse=True,
        )[:8],
        "manifest": manifest_update,
    }


if __name__ == "__main__":
    print(json.dumps(add_census_cps_recent.remote(), indent=2, sort_keys=True))

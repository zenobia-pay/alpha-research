"""Direct Modal-volume addition for BEA regional county GDP companion ZIPs."""

from __future__ import annotations

import csv
import hashlib
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import modal


APP_NAME = "econ-direct-bea-regional-county-gdp"
DATASET_ROOT = Path("/data/datasets/econ")
RAW_DIR = DATASET_ROOT / "raw" / "bea_regional_county_gdp_20260603"
SOURCE_PAGE = "https://apps.bea.gov/regional/downloadzip.cfm"
FILES = [
    {
        "key": "CAGDP1",
        "title": "County and MSA gross domestic product summary",
        "url": "https://apps.bea.gov/regional/zip/CAGDP1.zip",
    },
    {
        "key": "CAGDP2",
        "title": "County and MSA gross domestic product by industry",
        "url": "https://apps.bea.gov/regional/zip/CAGDP2.zip",
    },
    {
        "key": "CAGDP8",
        "title": "County and MSA real gross domestic product by industry",
        "url": "https://apps.bea.gov/regional/zip/CAGDP8.zip",
    },
    {
        "key": "CAINC35",
        "title": "Local-area personal current transfer receipts",
        "url": "https://apps.bea.gov/regional/zip/CAINC35.zip",
    },
]
PROBES = [
    "https://apps.bea.gov/regional/zip/CAINC20.zip",
    "https://apps.bea.gov/regional/zip/CA25.zip",
    "https://apps.bea.gov/regional/zip/CA25N.zip",
    "https://apps.bea.gov/regional/zip/SQINC4.zip",
    "https://apps.bea.gov/regional/zip/SQGDP9.zip",
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


def _download(url: str, destination: Path) -> dict[str, object]:
    request = Request(url, headers={"User-Agent": "alpha-research-canonical-direct/1.0"})
    with urlopen(request, timeout=300) as response:
        status = getattr(response, "status", 200)
        headers = dict(response.headers.items())
        with destination.open("wb") as handle:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                handle.write(chunk)
    if status != 200:
        raise RuntimeError(f"BEA returned status {status} for {url}")
    return {"status": status, "headers": headers}


def _zip_summary(path: Path) -> dict[str, object]:
    with zipfile.ZipFile(path) as archive:
        bad_member = archive.testzip()
        members = archive.infolist()
        member_rows: list[dict[str, object]] = []
        total_rows = 0
        max_field_count = 0
        first_header = ""
        for member in members:
            if member.is_dir():
                continue
            with archive.open(member) as handle:
                header = handle.readline().decode("utf-8-sig", errors="replace").strip()
                rows = sum(1 for _line in handle)
            field_count = len(next(csv.reader([header]))) if header else 0
            total_rows += rows
            max_field_count = max(max_field_count, field_count)
            if not first_header:
                first_header = header
            member_rows.append(
                {
                    "name": member.filename,
                    "compressed_bytes": member.compress_size,
                    "uncompressed_bytes": member.file_size,
                    "rows": rows,
                    "field_count": field_count,
                    "first_header": header,
                }
            )
    if bad_member:
        raise RuntimeError(f"BEA ZIP {path.name} failed integrity at {bad_member}")
    return {
        "member_count": len(members),
        "members": member_rows,
        "rows": total_rows,
        "field_count": max_field_count,
        "first_header": first_header,
    }


def _probe_url(url: str) -> dict[str, object]:
    destination = RAW_DIR / ("probe_" + url.rsplit("/", 1)[-1])
    try:
        response = _download(url, destination)
        prefix = destination.read_bytes()[:4]
        is_zip = prefix == b"PK\x03\x04"
        result = {
            "url": url,
            "status": response["status"],
            "bytes": destination.stat().st_size,
            "content_type": response["headers"].get("Content-Type"),
            "last_modified": response["headers"].get("Last-Modified"),
            "is_zip": is_zip,
        }
    except (HTTPError, URLError, RuntimeError) as exc:
        result = {"url": url, "error": str(exc), "is_zip": False}
    finally:
        if destination.exists():
            destination.unlink()
    return result


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
def add_bea_regional_county_gdp() -> dict[str, object]:
    if not DATASET_ROOT.exists():
        raise RuntimeError(f"Dataset root missing: {DATASET_ROOT}")

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    probe = RAW_DIR / ".write_probe"
    probe.write_text("ok\n")
    probe.unlink()

    retrieved_at = datetime.now(timezone.utc).isoformat()
    failed_probes = [_probe_url(url) for url in PROBES]
    records: list[dict[str, object]] = []
    manifest_entries: list[dict[str, object]] = []

    for item in FILES:
        url = item["url"]
        filename = url.rsplit("/", 1)[-1]
        path = RAW_DIR / filename
        print(f"{item['key']}: {url}", flush=True)
        response = _download(url, path)
        if path.stat().st_size < 4 or path.read_bytes()[:4] != b"PK\x03\x04":
            sample = path.read_bytes()[:300].decode("utf-8", errors="replace")
            path.unlink()
            raise RuntimeError(f"BEA response for {url} was not a ZIP: {sample}")
        summary = _zip_summary(path)
        record = {
            "key": item["key"],
            "title": item["title"],
            "filename": filename,
            "path": str(path.relative_to(DATASET_ROOT)),
            "source_url": url,
            "source_page": SOURCE_PAGE,
            "retrieved_at": retrieved_at,
            "bytes": path.stat().st_size,
            "sha256": _sha256(path),
            "http": response,
            "zip": summary,
        }
        records.append(record)
        manifest_entries.append(
            {
                "path": record["path"],
                "bytes": record["bytes"],
                "sha256": record["sha256"],
                "source_url": url,
                "source_key": "bea_regional_county_gdp",
                "retrieved_at": retrieved_at,
            }
        )

    metadata = {
        "dataset_id": "econ",
        "source_key": "bea_regional_county_gdp",
        "title": "BEA regional county and MSA GDP companion ZIPs",
        "source_page": SOURCE_PAGE,
        "retrieved_at": retrieved_at,
        "raw_dir": str(RAW_DIR.relative_to(DATASET_ROOT)),
        "file_count": len(records),
        "total_bytes": sum(int(record["bytes"]) for record in records),
        "total_rows": sum(int(record["zip"]["rows"]) for record in records),
        "records": records,
        "failed_probes": failed_probes,
        "notes": [
            "Provider-native BEA regional ZIP files retained as published.",
            "CAINC20, CA25, CA25N, SQINC4, and SQGDP9 direct ZIP probes returned HTML or non-ZIP responses and are recorded as failed probes.",
            "No merged regional panels or derived analysis tables were created.",
        ],
    }
    metadata_path = RAW_DIR / "metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2, sort_keys=True) + "\n")

    inventory_path = RAW_DIR / "inventory.csv"
    with inventory_path.open("w", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "key",
                "title",
                "filename",
                "path",
                "source_url",
                "bytes",
                "sha256",
                "rows",
                "field_count",
                "member_count",
                "last_modified",
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
                    "key": record["key"],
                    "title": record["title"],
                    "filename": record["filename"],
                    "path": record["path"],
                    "source_url": record["source_url"],
                    "bytes": record["bytes"],
                    "sha256": record["sha256"],
                    "rows": zip_summary.get("rows"),
                    "field_count": zip_summary.get("field_count"),
                    "member_count": zip_summary.get("member_count"),
                    "last_modified": headers.get("Last-Modified"),
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
        "total_rows": metadata["total_rows"],
        "records": [
            {
                "key": record["key"],
                "filename": record["filename"],
                "bytes": record["bytes"],
                "sha256": record["sha256"],
                "rows": record["zip"]["rows"],
                "field_count": record["zip"]["field_count"],
                "members": record["zip"]["members"],
            }
            for record in records
        ],
        "failed_probes": failed_probes,
        "manifest": manifest_result,
    }


@app.local_entrypoint()
def main() -> None:
    print(json.dumps(add_bea_regional_county_gdp.remote(), indent=2, sort_keys=True))

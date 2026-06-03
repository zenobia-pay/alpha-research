"""Direct Modal-volume addition for older CFTC COT historical ZIP families."""

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


APP_NAME = "econ-direct-cftc-cot-older-history"
DATASET_ROOT = Path("/data/datasets/econ")
RAW_DIR = DATASET_ROOT / "raw" / "cftc_cot_broader_report_families_2000_2019"
HISTORY_PAGE_URL = "https://www.cftc.gov/MarketReports/CommitmentsofTraders/HistoricalCompressed/index.htm"
YEARS = range(2000, 2020)
FAMILIES = [
    {
        "key": "legacy_futures_only",
        "label": "Legacy futures-only reports",
        "url": "https://www.cftc.gov/files/dea/history/deacot{year}.zip",
    },
    {
        "key": "legacy_futures_options",
        "label": "Legacy futures-and-options combined reports",
        "url": "https://www.cftc.gov/files/dea/history/deahistfo{year}.zip",
    },
    {
        "key": "disaggregated_futures_options",
        "label": "Disaggregated futures-and-options combined reports",
        "url": "https://www.cftc.gov/files/dea/history/com_disagg_txt_{year}.zip",
    },
    {
        "key": "tff_futures_only",
        "label": "Traders in Financial Futures futures-only reports",
        "url": "https://www.cftc.gov/files/dea/history/fut_fin_txt_{year}.zip",
    },
    {
        "key": "tff_futures_options",
        "label": "Traders in Financial Futures futures-and-options combined reports",
        "url": "https://www.cftc.gov/files/dea/history/com_fin_txt_{year}.zip",
    },
    {
        "key": "cit_supplement",
        "label": "Commodity Index Trader supplement",
        "url": "https://www.cftc.gov/files/dea/history/dea_cit_txt_{year}.zip",
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
                header = handle.readline().decode("latin-1", errors="replace").strip()
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
        raise RuntimeError(f"CFTC ZIP {path.name} failed integrity at {bad_member}")
    return {
        "member_count": len(members),
        "members": member_rows,
        "rows": total_rows,
        "field_count": max_field_count,
        "first_header": first_header,
    }


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
        raise RuntimeError(f"CFTC returned status {status} for {url}")
    if destination.stat().st_size < 4 or destination.read_bytes()[:4] != b"PK\x03\x04":
        sample = destination.read_bytes()[:300].decode("utf-8", errors="replace")
        raise RuntimeError(f"CFTC response was not a ZIP for {url}: {sample}")
    return {"status": status, "headers": headers}


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
def add_cftc_older_history() -> dict[str, object]:
    if not DATASET_ROOT.exists():
        raise RuntimeError(f"Dataset root missing: {DATASET_ROOT}")

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    probe = RAW_DIR / ".write_probe"
    probe.write_text("ok\n")
    probe.unlink()

    retrieved_at = datetime.now(timezone.utc).isoformat()
    records: list[dict[str, object]] = []
    failed: list[dict[str, object]] = []
    manifest_entries: list[dict[str, object]] = []

    for family in FAMILIES:
        family_dir = RAW_DIR / str(family["key"])
        family_dir.mkdir(parents=True, exist_ok=True)
        for year in YEARS:
            url = str(family["url"]).format(year=year)
            filename = url.rsplit("/", 1)[-1]
            path = family_dir / filename
            print(f"{family['key']} {year}: {url}", flush=True)
            try:
                response = _download(url, path)
                summary = _zip_summary(path)
            except (HTTPError, URLError, RuntimeError, zipfile.BadZipFile) as exc:
                if path.exists():
                    path.unlink()
                failed.append(
                    {
                        "family": family["key"],
                        "year": year,
                        "url": url,
                        "error": str(exc),
                    }
                )
                continue

            record = {
                "family": family["key"],
                "family_label": family["label"],
                "year": year,
                "filename": filename,
                "path": str(path.relative_to(DATASET_ROOT)),
                "source_url": url,
                "history_page_url": HISTORY_PAGE_URL,
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
                    "source_key": "cftc_cot_broader_report_families_2000_2019",
                    "retrieved_at": retrieved_at,
                }
            )

    if not records:
        raise RuntimeError(f"No CFTC files downloaded; failures: {failed[:5]}")

    metadata = {
        "dataset_id": "econ",
        "source_key": "cftc_cot_broader_report_families_2000_2019",
        "title": "CFTC Commitments of Traders broader report families older history",
        "history_page_url": HISTORY_PAGE_URL,
        "retrieved_at": retrieved_at,
        "raw_dir": str(RAW_DIR.relative_to(DATASET_ROOT)),
        "year_start": min(record["year"] for record in records),
        "year_end": max(record["year"] for record in records),
        "file_count": len(records),
        "failed_count": len(failed),
        "total_bytes": sum(int(record["bytes"]) for record in records),
        "total_rows": sum(int(record["zip"]["rows"]) for record in records),
        "families": FAMILIES,
        "records": records,
        "failed": failed,
        "notes": [
            "Provider-native official CFTC historical compressed text ZIP files retained as published.",
            "This backfills years before the existing 2020-2026 CFTC broader-family package.",
            "Some report families start after 2000; missing official URLs are recorded as failed attempts rather than filled from mirrors.",
        ],
    }
    metadata_path = RAW_DIR / "metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2, sort_keys=True) + "\n")

    inventory_path = RAW_DIR / "inventory.csv"
    with inventory_path.open("w", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "family",
                "year",
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
                    "family": record["family"],
                    "year": record["year"],
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

    source_notes_path = RAW_DIR / "source_notes.md"
    source_notes_path.write_text(
        "\n".join(
            [
                "# CFTC COT Older History",
                "",
                f"Official source catalog: {HISTORY_PAGE_URL}",
                "",
                "The files are CFTC historical compressed text ZIPs for Commitments of Traders report families.",
                "Provider ZIPs are preserved without deriving merged panels or normalized tables.",
                "Unavailable official URLs are recorded in metadata.json under `failed`.",
                "",
            ]
        )
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
            {
                "path": str(source_notes_path.relative_to(DATASET_ROOT)),
                "bytes": source_notes_path.stat().st_size,
                "sha256": _sha256(source_notes_path),
            },
        ]
    )
    manifest_result = _upsert_manifest(manifest_entries)
    volume.commit()

    by_family: dict[str, dict[str, object]] = {}
    for record in records:
        key = str(record["family"])
        item = by_family.setdefault(key, {"file_count": 0, "bytes": 0, "rows": 0, "years": []})
        item["file_count"] = int(item["file_count"]) + 1
        item["bytes"] = int(item["bytes"]) + int(record["bytes"])
        item["rows"] = int(item["rows"]) + int(record["zip"]["rows"])
        item["years"].append(record["year"])

    return {
        "status": "ok",
        "app": APP_NAME,
        "raw_dir": str(RAW_DIR.relative_to(DATASET_ROOT)),
        "retrieved_at": retrieved_at,
        "file_count": len(records),
        "failed_count": len(failed),
        "total_bytes": metadata["total_bytes"],
        "total_rows": metadata["total_rows"],
        "year_start": metadata["year_start"],
        "year_end": metadata["year_end"],
        "by_family": by_family,
        "failed_sample": failed[:12],
        "largest_files": sorted(
            (
                {
                    "family": record["family"],
                    "year": record["year"],
                    "filename": record["filename"],
                    "bytes": record["bytes"],
                    "sha256": record["sha256"],
                }
                for record in records
            ),
            key=lambda item: int(item["bytes"]),
            reverse=True,
        )[:8],
        "manifest": manifest_result,
    }


@app.local_entrypoint()
def main() -> None:
    print(json.dumps(add_cftc_older_history.remote(), indent=2, sort_keys=True))

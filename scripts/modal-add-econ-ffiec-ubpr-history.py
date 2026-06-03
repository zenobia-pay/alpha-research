"""Direct Modal-volume addition for historical FFIEC CDR UBPR ratio bulk ZIPs."""

from __future__ import annotations

import csv
import hashlib
import html.parser
import json
import os
import re
import zipfile
from datetime import datetime, timezone
from http.cookiejar import CookieJar
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import HTTPCookieProcessor, Request, build_opener

import modal


APP_NAME = "econ-direct-ffiec-ubpr-history"
PAGE_URL = "https://cdr.ffiec.gov/public/pws/downloadbulkdata.aspx?YIfTu=bhoGUvFzPN"
PRODUCT = "PerformanceReportingSeriesSinglePeriod"
PRODUCT_LABEL = "UBPR Ratio -- Single Period"
FORMAT = "XBRLRadiobutton"
DATASET_ROOT = Path("/data/datasets/econ")
RAW_DIR = DATASET_ROOT / "raw" / "ffiec_cdr_ubpr_ratio_history_20260603"

app = modal.App(APP_NAME)
volume = modal.Volume.from_name("agent-dataset")
image = modal.Image.debian_slim()


class FFIECParser(html.parser.HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.hidden: dict[str, str] = {}
        self.in_dates = False
        self.dates: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {name: value or "" for name, value in attrs}
        if tag.lower() == "input" and values.get("type", "").lower() == "hidden":
            name = values.get("name")
            if name:
                self.hidden[name] = values.get("value", "")
        if tag.lower() == "select" and values.get("id") == "DatesDropDownList":
            self.in_dates = True
        if tag.lower() == "option" and self.in_dates:
            self.dates.append({"value": values.get("value", ""), "label": ""})

    def handle_data(self, data: str) -> None:
        if self.in_dates and self.dates:
            self.dates[-1]["label"] += data.strip()

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "select":
            self.in_dates = False


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _parse(body: bytes) -> FFIECParser:
    parser = FFIECParser()
    parser.feed(body.decode("utf-8", errors="replace"))
    return parser


def _request(opener, data: dict[str, str] | None = None):
    headers = {
        "User-Agent": "alpha-research-canonical-direct/1.0",
        "Referer": PAGE_URL,
    }
    encoded = None
    if data is not None:
        encoded = urlencode(data).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    return opener.open(Request(PAGE_URL, data=encoded, headers=headers), timeout=300)


def _discover_dates(opener) -> tuple[list[dict[str, str]], dict[str, str]]:
    with _request(opener) as response:
        initial_parser = _parse(response.read())

    postback = dict(initial_parser.hidden)
    postback.update(
        {
            "__EVENTTARGET": "ctl00$MainContentHolder$ListBox1",
            "__EVENTARGUMENT": "",
            "ctl00$MainContentHolder$ListBox1": PRODUCT,
            "ctl00$MainContentHolder$FormatType": FORMAT,
        }
    )
    with _request(opener, postback) as response:
        product_parser = _parse(response.read())

    dates = [date for date in product_parser.dates if date["value"] and date["label"]]
    if not dates:
        raise RuntimeError("FFIEC UBPR date selector returned no options")
    return dates, product_parser.hidden


def _zip_summary(destination: Path) -> dict[str, object]:
    with zipfile.ZipFile(destination) as archive:
        bad_member = archive.testzip()
        members = archive.infolist()
        member_names = [member.filename for member in members]
        uncompressed_bytes = sum(member.file_size for member in members)
    if bad_member:
        raise RuntimeError(f"FFIEC ZIP {destination.name} failed integrity at {bad_member}")
    return {
        "member_count": len(members),
        "member_names": member_names,
        "uncompressed_bytes": uncompressed_bytes,
    }


def _download_zip(opener, hidden: dict[str, str], date: dict[str, str], destination: Path) -> dict[str, object]:
    if destination.exists() and destination.stat().st_size >= 4 and destination.read_bytes()[:4] == b"PK\x03\x04":
        try:
            summary = _zip_summary(destination)
            summary.update(
                {
                    "content_type": None,
                    "content_disposition": None,
                    "provider_filename": None,
                    "reused_existing": True,
                }
            )
            return summary
        except zipfile.BadZipFile:
            destination.unlink()
    elif destination.exists():
        destination.unlink()

    payload = dict(hidden)
    payload.update(
        {
            "ctl00$MainContentHolder$ListBox1": PRODUCT,
            "ctl00$MainContentHolder$DatesDropDownList": date["value"],
            "ctl00$MainContentHolder$FormatType": FORMAT,
            "ctl00$MainContentHolder$TabStrip1$Download_0": "Download",
        }
    )
    with _request(opener, payload) as response:
        content_type = response.headers.get("Content-Type")
        disposition = response.headers.get("Content-Disposition", "")
        with destination.open("wb") as handle:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                handle.write(chunk)

    if destination.stat().st_size < 4 or destination.read_bytes()[:4] != b"PK\x03\x04":
        sample = destination.read_bytes()[:500].decode("utf-8", errors="replace")
        raise RuntimeError(f"FFIEC response for {date['label']} was not a ZIP: {content_type} {sample}")

    summary = _zip_summary(destination)

    filename_match = re.search(r'filename="([^"]+)"', disposition)
    summary.update(
        {
            "content_type": content_type,
            "content_disposition": disposition,
            "provider_filename": filename_match.group(1) if filename_match else None,
            "reused_existing": False,
        }
    )
    return summary


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
def add_ffiec_ubpr_history(max_periods: int | None = None) -> dict[str, object]:
    if not DATASET_ROOT.exists():
        raise RuntimeError(f"Dataset root missing: {DATASET_ROOT}")

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    probe = RAW_DIR / ".write_probe"
    probe.write_text("ok\n")
    probe.unlink()

    retrieved_at = datetime.now(timezone.utc).isoformat()
    opener = build_opener(HTTPCookieProcessor(CookieJar()))
    dates, hidden = _discover_dates(opener)
    if max_periods is not None:
        dates = dates[:max_periods]
    print(f"discovered {len(dates)} UBPR periods to process", flush=True)

    records: list[dict[str, object]] = []
    manifest_entries: list[dict[str, object]] = []
    for index, date in enumerate(dates, start=1):
        yyyymmdd = datetime.strptime(date["label"], "%m/%d/%Y").strftime("%Y%m%d")
        filename = f"ffiec_cdr_ubpr_ratio_single_period_{yyyymmdd}.zip"
        path = RAW_DIR / filename
        print(f"[{index}/{len(dates)}] {date['label']} -> {filename}", flush=True)
        response = _download_zip(opener, hidden, date, path)
        record = {
            "path": str(path.relative_to(DATASET_ROOT)),
            "filename": filename,
            "report_date": date["label"],
            "period_id": date["value"],
            "bytes": path.stat().st_size,
            "sha256": _sha256(path),
            "source_url": PAGE_URL,
            "retrieved_at": retrieved_at,
            "response": response,
        }
        records.append(record)
        manifest_entries.append(
            {
                "path": record["path"],
                "bytes": record["bytes"],
                "sha256": record["sha256"],
                "source_url": PAGE_URL,
                "source_key": "ffiec_cdr_ubpr_ratio_history",
                "retrieved_at": retrieved_at,
            }
        )

    metadata = {
        "dataset_id": "econ",
        "source_key": "ffiec_cdr_ubpr_ratio_history",
        "title": "FFIEC CDR UBPR ratio single-period historical ZIPs",
        "page_url": PAGE_URL,
        "product": PRODUCT,
        "product_label": PRODUCT_LABEL,
        "retrieved_at": retrieved_at,
        "raw_dir": str(RAW_DIR.relative_to(DATASET_ROOT)),
        "file_count": len(records),
        "total_bytes": sum(int(record["bytes"]) for record in records),
        "period_start": records[-1]["report_date"],
        "period_end": records[0]["report_date"],
        "records": records,
        "notes": [
            "Provider-native FFIEC Central Data Repository UBPR ratio ZIPs retained as published.",
            "Date options were discovered from the FFIEC Bulk Data Download page after selecting UBPR Ratio -- Single Period.",
            "The official page disables TSV for this product and serves UBPR as XBRL ZIPs.",
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
                "report_date",
                "period_id",
                "filename",
                "path",
                "bytes",
                "sha256",
                "source_url",
                "retrieved_at",
                "provider_filename",
                "member_count",
                "uncompressed_bytes",
            ],
        )
        writer.writeheader()
        for record in records:
            response = record["response"]
            assert isinstance(response, dict)
            writer.writerow(
                {
                    "report_date": record["report_date"],
                    "period_id": record["period_id"],
                    "filename": record["filename"],
                    "path": record["path"],
                    "bytes": record["bytes"],
                    "sha256": record["sha256"],
                    "source_url": record["source_url"],
                    "retrieved_at": record["retrieved_at"],
                    "provider_filename": response.get("provider_filename"),
                    "member_count": response.get("member_count"),
                    "uncompressed_bytes": response.get("uncompressed_bytes"),
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
        "period_start": metadata["period_start"],
        "period_end": metadata["period_end"],
        "largest_files": sorted(
            (
                {
                    "filename": record["filename"],
                    "report_date": record["report_date"],
                    "bytes": record["bytes"],
                    "sha256": record["sha256"],
                }
                for record in records
            ),
            key=lambda item: int(item["bytes"]),
            reverse=True,
        )[:8],
        "newest_files": [
            {
                "filename": record["filename"],
                "report_date": record["report_date"],
                "bytes": record["bytes"],
                "sha256": record["sha256"],
            }
            for record in records[:4]
        ],
        "manifest": manifest_result,
    }


@app.local_entrypoint()
def main() -> None:
    max_periods = os.environ.get("MAX_PERIODS")
    print(
        json.dumps(
            add_ffiec_ubpr_history.remote(int(max_periods) if max_periods else None),
            indent=2,
            sort_keys=True,
        )
    )

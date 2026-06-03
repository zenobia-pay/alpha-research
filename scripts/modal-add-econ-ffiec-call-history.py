"""Direct Modal-volume addition for historical FFIEC CDR Call Report bulk ZIPs."""

from __future__ import annotations

import csv
import hashlib
import html.parser
import json
import re
import zipfile
from datetime import datetime, timezone
from http.cookiejar import CookieJar
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import HTTPCookieProcessor, Request, build_opener

import modal


APP_NAME = "econ-direct-ffiec-call-history"
PAGE_URL = "https://cdr.ffiec.gov/public/pws/downloadbulkdata.aspx?YIfTu=bhoGUvFzPN"
PRODUCT = "ReportingSeriesSinglePeriod"
FORMAT = "TSVRadioButton"
DATASET_ROOT = Path("/data/datasets/econ")
RAW_DIR = DATASET_ROOT / "raw" / "ffiec_cdr_call_bulk_history_20260515"

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


def _request(opener, url: str, data: dict[str, str] | None = None):
    headers = {
        "User-Agent": "alpha-research-canonical-direct/1.0",
        "Referer": PAGE_URL,
    }
    encoded = None
    if data is not None:
        encoded = urlencode(data).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    return opener.open(Request(url, data=encoded, headers=headers), timeout=300)


def _discover_dates(opener) -> tuple[list[dict[str, str]], dict[str, object]]:
    with _request(opener, PAGE_URL) as response:
        initial = response.read()
        initial_parser = _parse(initial)

    postback = dict(initial_parser.hidden)
    postback.update(
        {
            "__EVENTTARGET": "ctl00$MainContentHolder$ListBox1",
            "__EVENTARGUMENT": "",
            "ctl00$MainContentHolder$ListBox1": PRODUCT,
            "ctl00$MainContentHolder$FormatType": FORMAT,
        }
    )
    with _request(opener, PAGE_URL, postback) as response:
        product_page = response.read()
        product_parser = _parse(product_page)

    dates = [date for date in product_parser.dates if date["value"] and date["label"]]
    if not dates:
        raise RuntimeError("FFIEC Call Report date selector returned no options")
    return dates, {
        "hidden": product_parser.hidden,
        "date_count": len(dates),
        "first_date": dates[0]["label"],
        "last_date": dates[-1]["label"],
    }


def _download_zip(opener, hidden: dict[str, str], date: dict[str, str], destination: Path) -> dict[str, object]:
    payload = dict(hidden)
    payload.update(
        {
            "ctl00$MainContentHolder$ListBox1": PRODUCT,
            "ctl00$MainContentHolder$DatesDropDownList": date["value"],
            "ctl00$MainContentHolder$FormatType": FORMAT,
            "ctl00$MainContentHolder$TabStrip1$Download_0": "Download",
        }
    )
    with _request(opener, PAGE_URL, payload) as response:
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
    with zipfile.ZipFile(destination) as archive:
        bad_member = archive.testzip()
        members = archive.infolist()
        member_names = [member.filename for member in members]
        uncompressed_bytes = sum(member.file_size for member in members)
    if bad_member:
        raise RuntimeError(f"FFIEC ZIP for {date['label']} failed integrity at {bad_member}")

    filename_match = re.search(r'filename="([^"]+)"', disposition)
    return {
        "content_type": content_type,
        "content_disposition": disposition,
        "provider_filename": filename_match.group(1) if filename_match else None,
        "member_count": len(members),
        "member_names": member_names,
        "uncompressed_bytes": uncompressed_bytes,
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
def add_ffiec_call_history() -> dict[str, object]:
    if not DATASET_ROOT.exists():
        raise RuntimeError(f"Dataset root missing: {DATASET_ROOT}")

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    probe = RAW_DIR / ".write_probe"
    probe.write_text("ok\n")
    probe.unlink()

    retrieved_at = datetime.now(timezone.utc).isoformat()
    opener = build_opener(HTTPCookieProcessor(CookieJar()))
    dates, discovery = _discover_dates(opener)
    hidden = discovery["hidden"]
    if not isinstance(hidden, dict):
        raise RuntimeError("Internal FFIEC discovery state missing hidden fields")

    records: list[dict[str, object]] = []
    manifest_entries: list[dict[str, object]] = []
    for date in dates:
        yyyymmdd = datetime.strptime(date["label"], "%m/%d/%Y").strftime("%Y%m%d")
        filename = f"ffiec_cdr_call_bulk_all_schedules_{yyyymmdd}.zip"
        path = RAW_DIR / filename
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
                "source_key": "ffiec_cdr_call_bulk_history",
                "retrieved_at": retrieved_at,
            }
        )

    metadata = {
        "dataset_id": "econ",
        "source_key": "ffiec_cdr_call_bulk_history",
        "title": "FFIEC CDR Call Reports bulk all-schedules historical ZIPs",
        "page_url": PAGE_URL,
        "retrieved_at": retrieved_at,
        "raw_dir": str(RAW_DIR.relative_to(DATASET_ROOT)),
        "file_count": len(records),
        "total_bytes": sum(int(record["bytes"]) for record in records),
        "period_start": records[-1]["report_date"],
        "period_end": records[0]["report_date"],
        "records": records,
        "notes": [
            "Provider-native FFIEC Central Data Repository Call Report bulk all-schedules ZIPs retained as published.",
            "Date options were discovered from the FFIEC Bulk Data Download page after selecting Call Reports -- Single Period.",
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
        "manifest": manifest_result,
    }


@app.local_entrypoint()
def main() -> None:
    print(json.dumps(add_ffiec_call_history.remote(), indent=2, sort_keys=True))

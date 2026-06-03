"""Direct Modal-volume addition for BLS Labor Force Statistics from CPS flat files."""

from __future__ import annotations

import csv
import hashlib
import html.parser
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen

import modal


APP_NAME = "econ-direct-bls-cps-ln"
BASE_URL = "https://downloadt.bls.gov/pub/time.series/ln/"
DATASET_ROOT = Path("/data/datasets/econ")
RAW_DIR = DATASET_ROOT / "raw" / "bls_cps_labor_force_ln_20260114"

app = modal.App(APP_NAME)
volume = modal.Volume.from_name("agent-dataset")
image = modal.Image.debian_slim()


class LinkParser(html.parser.HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.hrefs: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        for name, value in attrs:
            if name.lower() == "href" and value:
                self.hrefs.append(value)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _fetch_listing() -> list[str]:
    request = Request(BASE_URL, headers={"User-Agent": "alpha-research-canonical-direct/1.0"})
    with urlopen(request, timeout=120) as response:
        body = response.read().decode("utf-8", errors="replace")
    parser = LinkParser()
    parser.feed(body)
    names: list[str] = []
    for href in parser.hrefs:
        name = href.rstrip("/").split("/")[-1]
        if name.startswith("ln."):
            names.append(name)
    return sorted(set(names))


def _download(name: str, destination: Path) -> dict[str, object]:
    url = urljoin(BASE_URL, name)
    request = Request(url, headers={"User-Agent": "alpha-research-canonical-direct/1.0"})
    with urlopen(request, timeout=300) as response:
        with destination.open("wb") as handle:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                handle.write(chunk)
        return {
            "url": url,
            "status": getattr(response, "status", None),
            "content_type": response.headers.get("Content-Type"),
            "last_modified": response.headers.get("Last-Modified"),
            "etag": response.headers.get("ETag"),
        }


def _line_count(path: Path) -> int:
    count = 0
    with path.open("rb") as handle:
        for _ in handle:
            count += 1
    return count


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
def add_bls_cps_ln() -> dict[str, object]:
    if not DATASET_ROOT.exists():
        raise RuntimeError(f"Dataset root missing: {DATASET_ROOT}")

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    probe = RAW_DIR / ".write_probe"
    probe.write_text("ok\n")
    probe.unlink()

    retrieved_at = datetime.now(timezone.utc).isoformat()
    names = _fetch_listing()
    if "ln.data.1.AllData" not in names or "ln.series" not in names:
        raise RuntimeError(f"BLS LN listing missing expected files: {names}")

    records: list[dict[str, object]] = []
    manifest_entries: list[dict[str, object]] = []
    for name in names:
        path = RAW_DIR / name
        response = _download(name, path)
        record = {
            "path": str(path.relative_to(DATASET_ROOT)),
            "filename": name,
            "bytes": path.stat().st_size,
            "sha256": _sha256(path),
            "source_url": urljoin(BASE_URL, name),
            "retrieved_at": retrieved_at,
            "lines": _line_count(path),
            "response": response,
        }
        records.append(record)
        manifest_entries.append(
            {
                "path": record["path"],
                "bytes": record["bytes"],
                "sha256": record["sha256"],
                "source_url": record["source_url"],
                "source_key": "bls_cps_labor_force_ln",
                "retrieved_at": retrieved_at,
            }
        )

    metadata = {
        "dataset_id": "econ",
        "source_key": "bls_cps_labor_force_ln",
        "title": "BLS Labor Force Statistics from the Current Population Survey flat files",
        "base_url": BASE_URL,
        "retrieved_at": retrieved_at,
        "raw_dir": str(RAW_DIR.relative_to(DATASET_ROOT)),
        "file_count": len(records),
        "total_bytes": sum(int(record["bytes"]) for record in records),
        "records": records,
        "notes": [
            "Provider-native BLS LN time-series files retained as published.",
            "Includes all-data time series, series metadata, documentation, and lookup/code tables for CPS labor-force dimensions.",
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
                "filename",
                "path",
                "bytes",
                "lines",
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
                    "filename": record["filename"],
                    "path": record["path"],
                    "bytes": record["bytes"],
                    "lines": record["lines"],
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
        "file_count": len(records),
        "total_bytes": metadata["total_bytes"],
        "largest_files": sorted(
            (
                {
                    "filename": record["filename"],
                    "bytes": record["bytes"],
                    "lines": record["lines"],
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
    print(json.dumps(add_bls_cps_ln.remote(), indent=2, sort_keys=True))

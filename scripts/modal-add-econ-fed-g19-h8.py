"""Direct Modal-volume addition for Federal Reserve G.19 and H.8 DDP data."""

from __future__ import annotations

import csv
import hashlib
import html.parser
import json
import re
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urljoin
from urllib.request import Request, urlopen

import modal


APP_NAME = "econ-direct-fed-g19-h8"
BASE_URL = "https://www.federalreserve.gov"
DATASET_ROOT = Path("/data/datasets/econ")
RAW_DIR = DATASET_ROOT / "raw" / "fed_g19_h8_ddp_20260603"

app = modal.App(APP_NAME)
volume = modal.Volume.from_name("agent-dataset")
image = modal.Image.debian_slim()

RELEASES = {
    "G19": {
        "title": "Federal Reserve Consumer Credit - G.19",
        "choose_url": f"{BASE_URL}/datadownload/Choose.aspx?rel=G19",
        "current_url": f"{BASE_URL}/releases/g19/current/default.htm",
        "pdf_url": f"{BASE_URL}/releases/g19/current/g19.pdf",
    },
    "H8": {
        "title": "Federal Reserve Assets and Liabilities of Commercial Banks in the United States - H.8",
        "choose_url": f"{BASE_URL}/datadownload/Choose.aspx?rel=H8",
        "current_url": f"{BASE_URL}/releases/h8/current/default.htm",
        "pdf_url": f"{BASE_URL}/releases/h8/current/h8.pdf",
    },
}


class DDPChooserParser(html.parser.HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.pending_package: dict[str, str] | None = None
        self.pending_option: dict[str, str] | None = None
        self.packages: list[dict[str, str]] = []
        self.all_data_href: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {name: value or "" for name, value in attrs}
        lower_tag = tag.lower()
        if lower_tag in {"input", "option"}:
            value = values.get("value", "")
            if "type=package" in value and "filetype=csv" in value:
                if lower_tag == "option":
                    self.pending_option = {"params": value.replace("&amp;", "&"), "label": ""}
                else:
                    self.pending_package = {"params": value.replace("&amp;", "&"), "label": ""}
        if lower_tag == "a" and values.get("id") == "AllData":
            self.all_data_href = values.get("href")

    def handle_data(self, data: str) -> None:
        if self.pending_package is not None:
            self.pending_package["label"] += data.strip()
        if self.pending_option is not None:
            self.pending_option["label"] += data.strip()

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "label" and self.pending_package is not None:
            self.packages.append(self.pending_package)
            self.pending_package = None
        if tag.lower() == "option" and self.pending_option is not None:
            self.packages.append(self.pending_option)
            self.pending_option = None


def _slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_")
    return slug[:100] or "package"


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _download(url: str, destination: Path) -> dict[str, object]:
    request = Request(url, headers={"User-Agent": "alpha-research-canonical-direct/1.0"})
    with urlopen(request, timeout=300) as response:
        content_type = response.headers.get("Content-Type")
        disposition = response.headers.get("Content-Disposition")
        last_modified = response.headers.get("Last-Modified")
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
    }


def _read_text(path: Path, max_lines: int = 8) -> dict[str, object]:
    lines: list[str] = []
    with path.open("r", encoding="utf-8-sig", errors="replace", newline="") as handle:
        reader = csv.reader(handle)
        for row_number, row in enumerate(reader):
            if row_number < max_lines:
                lines.append("|".join(row[:8]))
            else:
                break
    row_count = 0
    with path.open("r", encoding="utf-8-sig", errors="replace") as handle:
        for row_count, _line in enumerate(handle, start=1):
            pass
    return {"line_count": row_count, "sample_lines": lines}


def _inspect(path: Path) -> dict[str, object]:
    suffix = path.suffix.lower()
    if suffix == ".zip":
        with zipfile.ZipFile(path) as archive:
            bad_member = archive.testzip()
            members = archive.infolist()
            if bad_member:
                raise RuntimeError(f"{path.name} failed ZIP integrity at {bad_member}")
            return {
                "member_count": len(members),
                "member_names": [member.filename for member in members[:30]],
                "uncompressed_bytes": sum(member.file_size for member in members),
            }
    if suffix == ".csv":
        return _read_text(path)
    if suffix == ".pdf":
        with path.open("rb") as handle:
            if not handle.read(4).startswith(b"%PDF"):
                raise RuntimeError(f"{path.name} is not a PDF")
        return {}
    return {}


def _discover_packages(release: str, choose_url: str, choose_path: Path) -> dict[str, object]:
    _download(choose_url, choose_path)
    parser = DDPChooserParser()
    parser.feed(choose_path.read_text(encoding="utf-8", errors="replace"))
    packages: list[dict[str, str]] = []
    for index, package in enumerate(parser.packages, start=1):
        label = re.sub(r"\s+", " ", package["label"]).strip()
        params = package["params"]
        query = parse_qs(params, keep_blank_values=True)
        series = query.get("series", [""])[0]
        packages.append(
            {
                "release": release,
                "label": label,
                "params": params,
                "series_hash": series,
                "filename": f"{release.lower()}_{index:02d}_{_slug(label)}.csv",
                "url": f"{BASE_URL}/datadownload/Output.aspx?{params}",
            }
        )
    if not parser.all_data_href:
        raise RuntimeError(f"DDP chooser for {release} did not expose AllData ZIP link")
    return {
        "packages": packages,
        "all_data_url": urljoin(choose_url, parser.all_data_href.replace("&amp;", "&")),
    }


def _upsert_manifest(entries: list[dict[str, object]]) -> dict[str, object]:
    manifest_path = DATASET_ROOT / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    existing = {
        entry.get("path"): entry
        for entry in manifest.get("entries", [])
        if entry.get("source_key") != "fed_g19_h8_ddp"
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


@app.function(image=image, volumes={"/data": volume}, timeout=7200)
def add_fed_g19_h8() -> dict[str, object]:
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
    manifest_entries: list[dict[str, object]] = []

    for release, config in RELEASES.items():
        release_dir = RAW_DIR / release.lower()
        release_dir.mkdir(parents=True, exist_ok=True)
        choose_path = release_dir / f"{release.lower()}_ddp_choose.html"
        discovery = _discover_packages(release, config["choose_url"], choose_path)

        static_files = [
            (config["current_url"], release_dir / f"{release.lower()}_current.html", "current release HTML"),
            (config["pdf_url"], release_dir / f"{release.lower()}_current.pdf", "current release PDF"),
            (discovery["all_data_url"], release_dir / f"{release.lower()}_all_data_sdmx.zip", "all data SDMX ZIP"),
        ]
        for url, path, role in static_files:
            response = _download(str(url), path)
            inspection = _inspect(path)
            records.append(
                {
                    "release": release,
                    "role": role,
                    "label": role,
                    "path": str(path.relative_to(DATASET_ROOT)),
                    "filename": path.name,
                    "bytes": path.stat().st_size,
                    "sha256": _sha256(path),
                    "source_url": str(url),
                    "retrieved_at": retrieved_at,
                    "response": response,
                    "inspection": inspection,
                }
            )

        records.append(
            {
                "release": release,
                "role": "DDP chooser HTML",
                "label": "DDP chooser HTML",
                "path": str(choose_path.relative_to(DATASET_ROOT)),
                "filename": choose_path.name,
                "bytes": choose_path.stat().st_size,
                "sha256": _sha256(choose_path),
                "source_url": config["choose_url"],
                "retrieved_at": retrieved_at,
                "response": {},
                "inspection": {"package_count": len(discovery["packages"])},
            }
        )

        packages = discovery["packages"]
        assert isinstance(packages, list)
        for package in packages:
            path = release_dir / str(package["filename"])
            response = _download(str(package["url"]), path)
            inspection = _inspect(path)
            records.append(
                {
                    "release": release,
                    "role": "DDP preformatted CSV package",
                    "label": package["label"],
                    "series_hash": package["series_hash"],
                    "path": str(path.relative_to(DATASET_ROOT)),
                    "filename": path.name,
                    "bytes": path.stat().st_size,
                    "sha256": _sha256(path),
                    "source_url": package["url"],
                    "retrieved_at": retrieved_at,
                    "response": response,
                    "inspection": inspection,
                }
            )

    for record in records:
        manifest_entries.append(
            {
                "path": record["path"],
                "bytes": record["bytes"],
                "sha256": record["sha256"],
                "source_url": record["source_url"],
                "source_key": "fed_g19_h8_ddp",
                "retrieved_at": retrieved_at,
            }
        )

    metadata = {
        "dataset_id": "econ",
        "source_key": "fed_g19_h8_ddp",
        "title": "Federal Reserve G.19 and H.8 Data Download Program packages",
        "retrieved_at": retrieved_at,
        "raw_dir": str(RAW_DIR.relative_to(DATASET_ROOT)),
        "file_count": len(records),
        "total_bytes": sum(int(record["bytes"]) for record in records),
        "releases": RELEASES,
        "records": records,
        "notes": [
            "Provider-native Federal Reserve Data Download Program CSV packages and all-data SDMX ZIP files retained as published.",
            "Package identifiers were discovered from the official DDP chooser pages for G.19 and H.8.",
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
                "release",
                "role",
                "label",
                "filename",
                "path",
                "bytes",
                "sha256",
                "source_url",
                "retrieved_at",
                "line_count",
                "member_count",
                "uncompressed_bytes",
            ],
        )
        writer.writeheader()
        for record in records:
            inspection = record["inspection"]
            assert isinstance(inspection, dict)
            writer.writerow(
                {
                    "release": record["release"],
                    "role": record["role"],
                    "label": record["label"],
                    "filename": record["filename"],
                    "path": record["path"],
                    "bytes": record["bytes"],
                    "sha256": record["sha256"],
                    "source_url": record["source_url"],
                    "retrieved_at": record["retrieved_at"],
                    "line_count": inspection.get("line_count"),
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
                "source_url": BASE_URL,
                "source_key": "fed_g19_h8_ddp",
                "retrieved_at": retrieved_at,
            },
            {
                "path": str(inventory_path.relative_to(DATASET_ROOT)),
                "bytes": inventory_path.stat().st_size,
                "sha256": _sha256(inventory_path),
                "source_url": BASE_URL,
                "source_key": "fed_g19_h8_ddp",
                "retrieved_at": retrieved_at,
            },
        ]
    )
    manifest_update = _upsert_manifest(manifest_entries)
    volume.commit()

    by_release: dict[str, dict[str, object]] = {}
    for record in records:
        release = str(record["release"])
        summary = by_release.setdefault(release, {"files": 0, "bytes": 0, "csv_packages": 0})
        summary["files"] = int(summary["files"]) + 1
        summary["bytes"] = int(summary["bytes"]) + int(record["bytes"])
        if record["role"] == "DDP preformatted CSV package":
            summary["csv_packages"] = int(summary["csv_packages"]) + 1

    return {
        "raw_dir": str(RAW_DIR.relative_to(DATASET_ROOT)),
        "file_count": len(records),
        "total_bytes": metadata["total_bytes"],
        "by_release": by_release,
        "largest_files": sorted(
            [
                {
                    "filename": record["filename"],
                    "release": record["release"],
                    "bytes": record["bytes"],
                    "sha256": record["sha256"],
                    "role": record["role"],
                }
                for record in records
            ],
            key=lambda record: int(record["bytes"]),
            reverse=True,
        )[:8],
        "manifest": manifest_update,
    }


if __name__ == "__main__":
    print(json.dumps(add_fed_g19_h8.remote(), indent=2, sort_keys=True))

#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import re
from html import unescape
from pathlib import Path
from typing import Any

try:
    import pandas as pd
except Exception:
    pd = None

try:
    from pypdf import PdfReader
except Exception:
    PdfReader = None


TEXT_EXTENSIONS = {".txt", ".md", ".markdown", ".html", ".htm"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["auto", "tabular", "unstructured"], default="auto")
    parser.add_argument("--input", required=True)
    parser.add_argument("--id", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--dataset-id")
    parser.add_argument("--title-field")
    parser.add_argument("--summary-field")
    parser.add_argument("--text-fields")
    parser.add_argument("--date-field")
    parser.add_argument("--output-root", default="data/instances")
    parser.add_argument("--entity-type", default="row")
    parser.add_argument("--dataset-label-singular", default="record")
    parser.add_argument("--dataset-label-plural", default="records")
    return parser.parse_args()


def normalize_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float) and pd is not None and pd.isna(value):
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if pd is not None and hasattr(value, "item"):
        try:
            return normalize_value(value.item())
        except Exception:
            pass
    if isinstance(value, list):
        return [normalize_value(item) for item in value]
    return str(value)


def infer_kind(values: list[Any]) -> str:
    compact = [value for value in values if value not in (None, "", [])]
    if not compact:
        return "string"
    if all(isinstance(value, bool) for value in compact):
        return "boolean"
    if all(isinstance(value, (int, float)) and not isinstance(value, bool) for value in compact):
        return "number"
    lowered = [str(value).lower() for value in compact[:20]]
    if all("-" in value and len(value) >= 4 for value in lowered):
        return "date"
    return "string"


def choose_title_field(rows: list[dict[str, Any]], explicit: str | None) -> str:
    if explicit:
        return explicit
    preferred = ["title", "name", "username", "label", "tweet_id", "id"]
    columns = list(rows[0].keys()) if rows else []
    for candidate in preferred:
        if candidate in columns:
            return candidate
    return columns[0] if columns else "id"


def read_tabular_rows(path: Path) -> list[dict[str, Any]]:
    suffix = path.suffix.lower()
    if suffix == ".csv":
      with path.open("r", encoding="utf-8", newline="") as handle:
          return list(csv.DictReader(handle))
    if suffix == ".json":
        payload = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(payload, list):
            return [row for row in payload if isinstance(row, dict)]
        raise ValueError("JSON input must be a top-level array of objects")
    if suffix == ".parquet":
        if pd is None:
            raise RuntimeError("Parquet input requires pandas and pyarrow")
        frame = pd.read_parquet(path)
        return frame.to_dict(orient="records")
    raise ValueError(f"Unsupported tabular input format: {suffix}")


def strip_html(text: str) -> str:
    without_script = re.sub(r"<(script|style)[^>]*>.*?</\\1>", " ", text, flags=re.IGNORECASE | re.DOTALL)
    without_tags = re.sub(r"<[^>]+>", " ", without_script)
    return re.sub(r"\s+", " ", unescape(without_tags)).strip()


def read_unstructured_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".txt", ".md", ".markdown"}:
        return path.read_text(encoding="utf-8", errors="ignore")
    if suffix in {".html", ".htm"}:
        return strip_html(path.read_text(encoding="utf-8", errors="ignore"))
    if suffix == ".pdf":
        if PdfReader is None:
            raise RuntimeError("PDF input requires pypdf")
        reader = PdfReader(str(path))
        return "\n\n".join((page.extract_text() or "").strip() for page in reader.pages).strip()
    raise ValueError(f"Unsupported unstructured input format: {suffix}")


def collect_unstructured_files(path: Path) -> list[Path]:
    if path.is_file():
        return [path]
    if not path.is_dir():
        raise ValueError(f"Input path does not exist: {path}")
    files = [
        child for child in sorted(path.rglob("*"))
        if child.is_file() and (child.suffix.lower() in TEXT_EXTENSIONS or child.suffix.lower() == ".pdf")
    ]
    if not files:
        raise ValueError(f"No supported text files found under {path}")
    return files


def build_bundle(
    *,
    args: argparse.Namespace,
    descriptor_fields: list[dict[str, Any]],
    numeric_measures: list[dict[str, Any]],
    records: list[dict[str, Any]],
    projections: dict[str, list[dict[str, Any]]],
    description: str,
) -> dict[str, Any]:
    return {
        "implementation": {
            "id": args.id,
            "productName": args.name,
            "siteName": args.name.lower(),
            "siteDescription": f"Explore the {args.name} dataset with search, filters, and aggregation.",
            "datasetId": args.dataset_id or args.id,
            "datasetLabelSingular": args.dataset_label_singular,
            "datasetLabelPlural": args.dataset_label_plural,
            "heroTitle": f"{args.name}, rendered as a deployable data product.",
            "heroSubtitle": "This instance was generated from source files and is ready for the API and frontend stack.",
            "searchPlaceholder": f"Search {args.dataset_label_plural}...",
            "theme": {
                "accent": "#0d7a5f",
                "accentStrong": "#084d3d",
                "surface": "#eef7f3",
                "surfaceAlt": "#dbece5",
                "text": "#102019",
                "textMuted": "#52675f",
                "line": "#b7d0c7",
            },
        },
        "descriptor": {
            "id": args.dataset_id or args.id,
            "displayName": args.name,
            "description": description,
            "entityTypes": [args.entity_type],
            "fields": descriptor_fields,
            "measures": numeric_measures,
            "capabilities": {
                "textProjections": len(projections) > 0,
                "structuredFilters": True,
                "aggregations": len(numeric_measures) > 0,
                "artifacts": False,
            },
        },
        "records": records,
        "textProjectionsByRecordId": projections or None,
    }


def build_tabular_bundle(args: argparse.Namespace, input_path: Path) -> dict[str, Any]:
    rows = read_tabular_rows(input_path)
    if not rows:
        raise ValueError("Input dataset is empty")

    title_field = choose_title_field(rows, args.title_field)
    summary_field = args.summary_field
    text_fields = [item.strip() for item in (args.text_fields or "").split(",") if item.strip()]
    date_field = args.date_field
    columns = list(rows[0].keys())
    normalized_columns: dict[str, list[Any]] = {column: [] for column in columns}
    for row in rows:
        for column in columns:
            normalized_columns[column].append(normalize_value(row.get(column)))

    descriptor_fields = []
    numeric_measures = []
    for column in columns:
        kind = infer_kind(normalized_columns[column])
        descriptor_fields.append({
            "key": column,
            "label": column.replace("_", " ").title(),
            "kind": kind,
        })
        if kind == "number":
            numeric_measures.append({
                "key": column,
                "label": column.replace("_", " ").title(),
            })

    records: list[dict[str, Any]] = []
    projections: dict[str, list[dict[str, Any]]] = {}
    for index, row in enumerate(rows):
        values = {key: normalize_value(value) for key, value in row.items()}
        record_id = str(values.get("id") or values.get("tweet_id") or values.get("record_id") or f"{args.id}-{index + 1}")
        title = str(values.get(title_field) or f"{args.name} #{index + 1}")
        summary = str(values.get(summary_field)) if summary_field and values.get(summary_field) is not None else None
        observed_at = str(values.get(date_field)) if date_field and values.get(date_field) is not None else None
        records.append({
            "id": record_id,
            "datasetId": args.dataset_id or args.id,
            "entityType": args.entity_type,
            "title": title,
            "summary": summary,
            "observedAt": observed_at,
            "values": values,
        })
        if text_fields:
            text_parts = [f"{field}: {values.get(field)}" for field in text_fields if values.get(field) not in (None, "")]
            if text_parts:
                projections[record_id] = [{
                    "id": f"{record_id}-projection",
                    "recordId": record_id,
                    "title": title,
                    "text": "\n\n".join(text_parts),
                    "sourceLabel": args.name,
                    "metadata": {
                        "fields": text_fields,
                    },
                }]
    return build_bundle(
        args=args,
        descriptor_fields=descriptor_fields,
        numeric_measures=numeric_measures,
        records=records,
        projections=projections,
        description=f"Normalized tabular dataset from {input_path.name}",
    )


def build_unstructured_bundle(args: argparse.Namespace, input_path: Path) -> dict[str, Any]:
    files = collect_unstructured_files(input_path)
    descriptor_fields = [
        {"key": "path", "label": "Path", "kind": "string"},
        {"key": "extension", "label": "Extension", "kind": "category"},
        {"key": "byte_size", "label": "Byte Size", "kind": "number"},
        {"key": "parent_directory", "label": "Parent Directory", "kind": "string"},
    ]
    numeric_measures = [
        {"key": "byte_size", "label": "Byte Size"},
    ]
    records: list[dict[str, Any]] = []
    projections: dict[str, list[dict[str, Any]]] = {}

    for index, file_path in enumerate(files):
        text = read_unstructured_text(file_path).strip()
        if not text:
            continue
        record_id = f"{args.id}-{index + 1}"
        title = file_path.stem.replace("_", " ").replace("-", " ").strip() or file_path.name
        relative_path = str(file_path.relative_to(input_path)) if input_path.is_dir() else file_path.name
        values = {
            "path": relative_path,
            "extension": file_path.suffix.lower(),
            "byte_size": file_path.stat().st_size,
            "parent_directory": file_path.parent.name,
        }
        records.append({
            "id": record_id,
            "datasetId": args.dataset_id or args.id,
            "entityType": "document" if args.entity_type == "row" else args.entity_type,
            "title": title,
            "summary": text[:280],
            "observedAt": None,
            "values": values,
        })
        projections[record_id] = [{
            "id": f"{record_id}-projection",
            "recordId": record_id,
            "title": title,
            "text": text,
            "sourceLabel": relative_path,
            "metadata": values,
        }]

    if not records:
        raise ValueError("No non-empty text documents were extracted")

    return build_bundle(
        args=args,
        descriptor_fields=descriptor_fields,
        numeric_measures=numeric_measures,
        records=records,
        projections=projections,
        description=f"Normalized unstructured corpus from {input_path.name}",
    )


def detect_mode(path: Path) -> str:
    if path.is_dir():
        return "unstructured"
    if path.suffix.lower() in {".csv", ".json", ".parquet"}:
        return "tabular"
    return "unstructured"


def main() -> None:
    args = parse_args()
    input_path = Path(args.input).expanduser().resolve()
    mode = args.mode if args.mode != "auto" else detect_mode(input_path)
    bundle = build_tabular_bundle(args, input_path) if mode == "tabular" else build_unstructured_bundle(args, input_path)
    output_dir = Path(args.output_root).expanduser().resolve() / args.id
    output_dir.mkdir(parents=True, exist_ok=True)
    target = output_dir / "instance.json"
    target.write_text(json.dumps(bundle, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "ok": True,
        "mode": mode,
        "path": str(target),
        "records": len(bundle["records"]),
        "textProjectionRecords": len(bundle.get("textProjectionsByRecordId") or {}),
        "numericMeasures": len(bundle["descriptor"].get("measures") or []),
    }, indent=2))


if __name__ == "__main__":
    main()

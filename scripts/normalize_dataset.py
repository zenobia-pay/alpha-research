#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any

try:
    import pandas as pd
except Exception:
    pd = None


def read_rows(path: Path) -> list[dict[str, Any]]:
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
    raise ValueError(f"Unsupported input format: {suffix}")


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
    if all("-" in value and len(value) >= 8 for value in lowered):
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
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


def main() -> None:
    args = parse_args()
    input_path = Path(args.input).expanduser().resolve()
    rows = read_rows(input_path)
    if not rows:
        raise ValueError("Input dataset is empty")

    dataset_id = args.dataset_id or args.id
    title_field = choose_title_field(rows, args.title_field)
    summary_field = args.summary_field
    text_fields = [item.strip() for item in (args.text_fields or "").split(",") if item.strip()]
    date_field = args.date_field

    columns = list(rows[0].keys())
    descriptor_fields = []
    numeric_measures = []
    normalized_columns: dict[str, list[Any]] = {column: [] for column in columns}

    for row in rows:
        for column in columns:
            normalized_columns[column].append(normalize_value(row.get(column)))

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

    records = []
    projections: dict[str, list[dict[str, Any]]] = {}

    for index, row in enumerate(rows):
        values = {key: normalize_value(value) for key, value in row.items()}
        record_id = str(values.get("id") or values.get("tweet_id") or values.get("record_id") or f"{args.id}-{index + 1}")
        title = str(values.get(title_field) or f"{args.name} #{index + 1}")
        summary = str(values.get(summary_field)) if summary_field and values.get(summary_field) is not None else None
        observed_at = str(values.get(date_field)) if date_field and values.get(date_field) is not None else None
        records.append({
            "id": record_id,
            "datasetId": dataset_id,
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

    bundle = {
        "implementation": {
            "id": args.id,
            "productName": args.name,
            "siteName": args.name.lower(),
            "siteDescription": f"Explore the {args.name} dataset with search, filters, and aggregation.",
            "datasetId": dataset_id,
            "datasetLabelSingular": args.dataset_label_singular,
            "datasetLabelPlural": args.dataset_label_plural,
            "heroTitle": f"{args.name}, rendered as a deployable data product.",
            "heroSubtitle": "This instance was generated from an arbitrary dataset file and is now ready for the API and frontend stack.",
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
            "id": dataset_id,
            "displayName": args.name,
            "description": f"Normalized from {input_path.name}",
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

    output_dir = Path(args.output_root).expanduser().resolve() / args.id
    output_dir.mkdir(parents=True, exist_ok=True)
    target = output_dir / "instance.json"
    target.write_text(json.dumps(bundle, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "ok": True,
        "path": str(target),
        "records": len(records),
        "textProjectionRecords": len(projections),
        "numericMeasures": len(numeric_measures),
    }, indent=2))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import gzip
import json
import re
import sys
import time
from html import unescape
from pathlib import Path
from typing import Any

try:
    import pandas as pd
except Exception:
    pd = None

try:
    import pyarrow.parquet as pq
except Exception:
    pq = None

try:
    from pypdf import PdfReader
except Exception:
    PdfReader = None


TEXT_EXTENSIONS = {".txt", ".md", ".markdown", ".html", ".htm"}
PROGRESS_ROW_INTERVAL = 100_000


START_TIME = time.perf_counter()


def log(message: str) -> None:
    elapsed = time.perf_counter() - START_TIME
    print(f"[research ingest +{elapsed:0.1f}s] {message}", file=sys.stderr, flush=True)


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
    parser.add_argument("--shard-record-limit", type=int, default=50000)
    parser.add_argument("--compression", choices=["none", "gzip"], default="gzip")
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


def infer_scalar_kind(value: Any) -> str:
    normalized = normalize_value(value)
    if normalized in (None, "", []):
        return "empty"
    if isinstance(normalized, bool):
        return "boolean"
    if isinstance(normalized, (int, float)) and not isinstance(normalized, bool):
        return "number"
    text = str(normalized).strip()
    if re.fullmatch(r"true|false", text, flags=re.IGNORECASE):
        return "boolean"
    if re.fullmatch(r"-?\d+(\.\d+)?", text):
        return "number"
    if "-" in text and len(text) >= 4:
        return "date"
    return "string"


def cast_value_for_kind(value: Any, kind: str) -> Any:
    normalized = normalize_value(value)
    if normalized in (None, "", []):
        return None
    if kind == "number":
        if isinstance(normalized, (int, float)) and not isinstance(normalized, bool):
            return normalized
        text = str(normalized).strip()
        if re.fullmatch(r"-?\d+", text):
            return int(text)
        if re.fullmatch(r"-?\d+\.\d+", text):
            return float(text)
    if kind == "boolean":
        if isinstance(normalized, bool):
            return normalized
        text = str(normalized).strip().lower()
        if text == "true":
            return True
        if text == "false":
            return False
    return normalized


def infer_kind(values: list[Any]) -> str:
    compact = [value for value in values if normalize_value(value) not in (None, "", [])]
    if not compact:
        return "string"
    scalar_kinds = [infer_scalar_kind(value) for value in compact[:100]]
    if all(kind == "boolean" for kind in scalar_kinds):
        return "boolean"
    if all(kind == "number" for kind in scalar_kinds):
        return "number"
    if all(infer_scalar_kind(value) == "date" for value in compact[:20]):
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
    log(f"Reading tabular input from {path} ({suffix or 'no extension'})")
    if suffix == ".csv":
        with path.open("r", encoding="utf-8", newline="") as handle:
            rows = list(csv.DictReader(handle))
            log(f"Loaded {len(rows):,} CSV rows")
            return rows
    if suffix == ".json":
        payload = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(payload, list):
            rows = [row for row in payload if isinstance(row, dict)]
            log(f"Loaded {len(rows):,} JSON rows")
            return rows
        raise ValueError("JSON input must be a top-level array of objects")
    if suffix == ".parquet":
        if pd is None:
            raise RuntimeError("Parquet input requires pandas and pyarrow")
        log("Loading parquet via pandas.read_parquet(...)")
        frame = pd.read_parquet(path)
        log(f"Loaded parquet frame with {len(frame):,} rows and {len(frame.columns):,} columns")
        rows = frame.to_dict(orient="records")
        log(f"Converted parquet frame into {len(rows):,} row objects")
        return rows
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
    log(f"Collected {len(files):,} unstructured files from {path}")
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


def build_implementation(args: argparse.Namespace) -> dict[str, Any]:
    return {
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
    }


def build_descriptor(
    args: argparse.Namespace,
    *,
    descriptor_fields: list[dict[str, Any]],
    numeric_measures: list[dict[str, Any]],
    description: str,
    has_text_projections: bool,
) -> dict[str, Any]:
    return {
        "id": args.dataset_id or args.id,
        "displayName": args.name,
        "description": description,
        "entityTypes": [args.entity_type],
        "fields": descriptor_fields,
        "measures": numeric_measures,
        "capabilities": {
            "textProjections": has_text_projections,
            "structuredFilters": True,
            "aggregations": len(numeric_measures) > 0,
            "artifacts": False,
        },
    }


def sanitize_path_value(value: str) -> str:
    return re.sub(r"[^a-z0-9._-]+", "-", value.lower()).strip("-")[:64] or "unknown"


def choose_partition_keys(bundle: dict[str, Any]) -> list[str]:
    descriptor = bundle["descriptor"]
    keys: list[str] = []
    if len(descriptor.get("entityTypes") or []) > 1:
        keys.append("entityType")
    if any(field.get("kind") == "date" for field in descriptor.get("fields") or []):
        keys.append("observedYear")
    geography_field = next((field for field in descriptor.get("fields") or [] if field.get("kind") == "geography"), None)
    if geography_field:
        keys.append(str(geography_field["key"]))
    category_field = next((field for field in descriptor.get("fields") or [] if field.get("kind") == "category"), None)
    if category_field:
        keys.append(str(category_field["key"]))
    return keys[:2]


def infer_partition_value(record: dict[str, Any], key: str) -> str | None:
    if key == "entityType":
        return str(record.get("entityType") or "unknown")
    if key == "observedYear":
        observed_at = record.get("observedAt")
        return str(observed_at)[:4] if observed_at else None
    value = (record.get("values") or {}).get(key)
    if isinstance(value, list):
        value = value[0] if value else None
    return None if value in (None, "") else str(value)


def chunk_values(values: list[Any], size: int) -> list[list[Any]]:
    return [values[index:index + size] for index in range(0, len(values), max(1, size))]


def prepare_tabular_schema(
    args: argparse.Namespace,
    rows: list[dict[str, Any]],
    input_path: Path,
) -> dict[str, Any]:
    if not rows:
        raise ValueError("Input dataset is empty")
    title_field = choose_title_field(rows, args.title_field)
    summary_field = args.summary_field
    text_fields = [item.strip() for item in (args.text_fields or "").split(",") if item.strip()]
    date_field = args.date_field
    columns = list(rows[0].keys())
    log(f"Discovered {len(columns):,} columns; title={title_field}, summary={summary_field or '-'}, date={date_field or '-'}")

    normalized_columns: dict[str, list[Any]] = {column: [] for column in columns}
    for row in rows:
        for column in columns:
            normalized_columns[column].append(normalize_value(row.get(column)))

    descriptor_fields = []
    numeric_measures = []
    column_kinds: dict[str, str] = {}
    for column in columns:
        kind = infer_kind(normalized_columns[column])
        column_kinds[column] = kind
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

    implementation = build_implementation(args)
    descriptor = build_descriptor(
        args,
        descriptor_fields=descriptor_fields,
        numeric_measures=numeric_measures,
        description=f"Normalized tabular dataset from {input_path.name}",
        has_text_projections=len(text_fields) > 0,
    )
    return {
        "implementation": implementation,
        "descriptor": descriptor,
        "column_kinds": column_kinds,
        "title_field": title_field,
        "summary_field": summary_field,
        "text_fields": text_fields,
        "date_field": date_field,
        "numeric_measures": numeric_measures,
        "descriptor_fields": descriptor_fields,
    }


def build_tabular_record(
    args: argparse.Namespace,
    row: dict[str, Any],
    row_index: int,
    schema: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    column_kinds = schema["column_kinds"]
    values = {key: cast_value_for_kind(value, column_kinds[key]) for key, value in row.items()}
    record_id = str(values.get("id") or values.get("tweet_id") or values.get("record_id") or f"{args.id}-{row_index + 1}")
    title = str(values.get(schema["title_field"]) or f"{args.name} #{row_index + 1}")
    summary_field = schema["summary_field"]
    summary = str(values.get(summary_field)) if summary_field and values.get(summary_field) is not None else None
    date_field = schema["date_field"]
    observed_at = str(values.get(date_field)) if date_field and values.get(date_field) is not None else None
    record = {
        "id": record_id,
        "datasetId": args.dataset_id or args.id,
        "entityType": args.entity_type,
        "title": title,
        "summary": summary,
        "observedAt": observed_at,
        "values": values,
    }
    projection = None
    text_fields = schema["text_fields"]
    if text_fields:
        text_parts = [f"{field}: {values.get(field)}" for field in text_fields if values.get(field) not in (None, "")]
        if text_parts:
            projection = {
                "id": f"{record_id}-projection",
                "recordId": record_id,
                "title": title,
                "text": "\n\n".join(text_parts),
                "sourceLabel": args.name,
                "metadata": {
                    "fields": text_fields,
                },
            }
    return record, projection


def write_jsonl_rows(path: Path, rows: list[dict[str, Any]], compression: str) -> int:
    payload = "".join(json.dumps(row, separators=(",", ":")) + "\n" for row in rows)
    if compression == "gzip":
        encoded = gzip.compress(payload.encode("utf-8"), compresslevel=6)
        path.write_bytes(encoded)
        return len(encoded)
    path.write_text(payload, encoding="utf-8")
    return path.stat().st_size


def write_shard(
    *,
    kind: str,
    shard_index: int,
    rows: list[dict[str, Any]],
    output_dir: Path,
    compression: str,
    partition_keys: list[str] | None = None,
) -> dict[str, Any]:
    partition_entries: list[tuple[str, str]] = []
    if kind == "records" and rows and partition_keys:
        for key in partition_keys:
            value = infer_partition_value(rows[0], key)
            if value:
                partition_entries.append((key, value))
    partition_prefix = (
        "/".join(f"{key}={sanitize_path_value(value)}" for key, value in partition_entries) + "/"
        if partition_entries else ""
    )
    filename = f"part-{shard_index:05d}.jsonl" + (".gz" if compression == "gzip" else "")
    relative_path = f"{kind.replace('_', '-')}/{partition_prefix}{filename}"
    target = output_dir / relative_path
    target.parent.mkdir(parents=True, exist_ok=True)
    byte_size = write_jsonl_rows(target, rows, compression)
    label = "record" if kind == "records" else "text projection"
    log(
        f"Wrote {label} shard {shard_index + 1:,}: "
        f"{relative_path} ({len(rows):,} rows, {byte_size:,} bytes)"
    )
    return {
        "id": f"{kind.replace('_', '-')}-{shard_index}",
        "kind": kind,
        "path": relative_path,
        "format": "jsonl",
        "compression": compression,
        "rowCount": len(rows),
        "byteSize": byte_size,
        "partitions": {key: value for key, value in partition_entries} or None,
    }


def write_sharded_instance(args: argparse.Namespace, bundle: dict[str, Any], output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    shard_limit = max(1, args.shard_record_limit)
    compression = args.compression
    partition_keys = choose_partition_keys(bundle)
    records = bundle["records"]
    projections = [
        projection
        for projection_list in (bundle.get("textProjectionsByRecordId") or {}).values()
        for projection in projection_list
    ]
    shards: list[dict[str, Any]] = []
    record_chunks = chunk_values(records, shard_limit)
    projection_chunks = chunk_values(projections, shard_limit)

    log(
        "Writing sharded package: "
        f"{len(records):,} records, {len(projections):,} text projections, "
        f"shard size {shard_limit:,}, compression={compression}"
    )

    for index, rows in enumerate(record_chunks):
        partition_entries = []
        if rows:
            for key in partition_keys:
                value = infer_partition_value(rows[0], key)
                if value:
                    partition_entries.append((key, value))
        partition_prefix = (
            "/".join(f"{key}={sanitize_path_value(value)}" for key, value in partition_entries) + "/"
            if partition_entries else ""
        )
        filename = f"part-{index:05d}.jsonl" + (".gz" if compression == "gzip" else "")
        relative_path = f"records/{partition_prefix}{filename}"
        target = output_dir / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        byte_size = write_jsonl_rows(target, rows, compression)
        log(
            f"Wrote record shard {index + 1:,}/{max(1, len(record_chunks)):,}: "
            f"{relative_path} ({len(rows):,} rows, {byte_size:,} bytes)"
        )
        shards.append({
            "id": f"records-{index}",
            "kind": "records",
            "path": relative_path,
            "format": "jsonl",
            "compression": compression,
            "rowCount": len(rows),
            "byteSize": byte_size,
            "partitions": {key: value for key, value in partition_entries} or None,
        })

    for index, rows in enumerate(projection_chunks):
        filename = f"part-{index:05d}.jsonl" + (".gz" if compression == "gzip" else "")
        relative_path = f"text-projections/{filename}"
        target = output_dir / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        byte_size = write_jsonl_rows(target, rows, compression)
        log(
            f"Wrote text projection shard {index + 1:,}/{max(1, len(projection_chunks)):,}: "
            f"{relative_path} ({len(rows):,} rows, {byte_size:,} bytes)"
        )
        shards.append({
            "id": f"text-projections-{index}",
            "kind": "text_projections",
            "path": relative_path,
            "format": "jsonl",
            "compression": compression,
            "rowCount": len(rows),
            "byteSize": byte_size,
        })

    manifest = {
        "version": 2,
        "layout": "sharded",
        "implementation": bundle["implementation"],
        "descriptor": bundle["descriptor"],
        "storageProfile": {
            "canonicalStore": "object_storage",
            "catalog": "postgres",
            "vectorIndex": "qdrant" if projections else "none",
            "textIndex": "typesense" if projections else "none",
            "tabularFormat": "parquet",
            "textFormat": "jsonl",
            "textCompression": compression,
        },
        "stats": {
            "recordCount": len(records),
            "textProjectionCount": len(projections),
            "shardCount": len(shards),
        },
        "samples": {
            "records": records[:12],
        },
        "shards": shards,
    }
    target = output_dir / "manifest.json"
    target.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    log(f"Wrote manifest to {target}")
    return target


def stream_parquet_to_sharded_instance(args: argparse.Namespace, input_path: Path) -> dict[str, Any]:
    if pq is None:
        raise RuntimeError("Streaming parquet ingest requires pyarrow to be installed in the Python environment.")

    output_dir = Path(args.output_root).expanduser().resolve() / args.id
    output_dir.mkdir(parents=True, exist_ok=True)
    compression = args.compression
    shard_limit = max(1, args.shard_record_limit)

    log(f"Opening parquet source with pyarrow: {input_path}")
    parquet_file = pq.ParquetFile(input_path)
    log(
        f"Parquet metadata: {parquet_file.metadata.num_rows:,} rows, "
        f"{parquet_file.metadata.num_columns:,} columns, {parquet_file.num_row_groups:,} row groups"
    )

    sample_rows: list[dict[str, Any]] = []
    sample_target = min(2_000, shard_limit)
    for batch in parquet_file.iter_batches(batch_size=sample_target):
        sample_rows.extend(batch.to_pylist())
        if len(sample_rows) >= sample_target:
            sample_rows = sample_rows[:sample_target]
            break
    log(f"Collected {len(sample_rows):,} sample rows for schema inference")

    schema = prepare_tabular_schema(args, sample_rows, input_path)
    partition_keys = choose_partition_keys({
        "descriptor": schema["descriptor"],
        "records": [],
    })
    log(
        f"Streaming parquet into shards with batch size {shard_limit:,}; "
        f"partition keys={', '.join(partition_keys) if partition_keys else '-'}"
    )

    record_buffer: list[dict[str, Any]] = []
    projection_buffer: list[dict[str, Any]] = []
    sample_records: list[dict[str, Any]] = []
    shards: list[dict[str, Any]] = []
    record_count = 0
    projection_count = 0
    record_shard_index = 0
    projection_shard_index = 0

    for batch_index, batch in enumerate(parquet_file.iter_batches(batch_size=shard_limit)):
        rows = batch.to_pylist()
        log(f"Processing parquet batch {batch_index + 1:,} with {len(rows):,} rows")
        for row in rows:
            record, projection = build_tabular_record(args, row, record_count, schema)
            record_buffer.append(record)
            record_count += 1
            if len(sample_records) < 12:
                sample_records.append(record)
            if projection is not None:
                projection_buffer.append(projection)
                projection_count += 1
            if record_count % PROGRESS_ROW_INTERVAL == 0:
                log(
                    f"Normalized {record_count:,}/{parquet_file.metadata.num_rows:,} parquet rows "
                    f"({projection_count:,} text projections)"
                )
            if len(record_buffer) >= shard_limit:
                shards.append(write_shard(
                    kind="records",
                    shard_index=record_shard_index,
                    rows=record_buffer,
                    output_dir=output_dir,
                    compression=compression,
                    partition_keys=partition_keys,
                ))
                record_shard_index += 1
                record_buffer = []
            if len(projection_buffer) >= shard_limit:
                shards.append(write_shard(
                    kind="text_projections",
                    shard_index=projection_shard_index,
                    rows=projection_buffer,
                    output_dir=output_dir,
                    compression=compression,
                ))
                projection_shard_index += 1
                projection_buffer = []

    if record_buffer:
        shards.append(write_shard(
            kind="records",
            shard_index=record_shard_index,
            rows=record_buffer,
            output_dir=output_dir,
            compression=compression,
            partition_keys=partition_keys,
        ))
    if projection_buffer:
        shards.append(write_shard(
            kind="text_projections",
            shard_index=projection_shard_index,
            rows=projection_buffer,
            output_dir=output_dir,
            compression=compression,
        ))

    manifest = {
        "version": 2,
        "layout": "sharded",
        "implementation": schema["implementation"],
        "descriptor": schema["descriptor"],
        "storageProfile": {
            "canonicalStore": "object_storage",
            "catalog": "postgres",
            "vectorIndex": "qdrant" if projection_count > 0 else "none",
            "textIndex": "typesense" if projection_count > 0 else "none",
            "tabularFormat": "parquet",
            "textFormat": "jsonl",
            "textCompression": compression,
        },
        "stats": {
            "recordCount": record_count,
            "textProjectionCount": projection_count,
            "shardCount": len(shards),
        },
        "samples": {
            "records": sample_records[:12],
        },
        "shards": shards,
    }
    target = output_dir / "manifest.json"
    target.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    log(f"Wrote manifest to {target}")
    return {
        "ok": True,
        "mode": "tabular",
        "path": str(target),
        "records": record_count,
        "textProjectionRecords": projection_count,
        "numericMeasures": len(schema["numeric_measures"]),
        "layout": "sharded",
        "compression": compression,
        "shardRecordLimit": shard_limit,
        "streaming": True,
    }


def write_streaming_sharded_instance(
    args: argparse.Namespace,
    *,
    implementation: dict[str, Any],
    descriptor: dict[str, Any],
    output_dir: Path,
    record_rows: list[dict[str, Any]],
    projection_rows: list[dict[str, Any]],
    sample_records: list[dict[str, Any]],
    record_count: int,
    projection_count: int,
) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    shard_limit = max(1, args.shard_record_limit)
    compression = args.compression
    bundle = {
        "descriptor": descriptor,
        "records": record_rows,
        "textProjectionsByRecordId": {
            projection["recordId"]: [projection] for projection in projection_rows
        },
    }
    partition_keys = choose_partition_keys(bundle)
    shards: list[dict[str, Any]] = []
    record_chunks = chunk_values(record_rows, shard_limit)
    projection_chunks = chunk_values(projection_rows, shard_limit)

    log(
        "Finalizing sharded package: "
        f"{record_count:,} records, {projection_count:,} text projections, "
        f"remaining buffered records={len(record_rows):,}, projections={len(projection_rows):,}"
    )

    for index, rows in enumerate(record_chunks):
        partition_entries = []
        if rows:
            for key in partition_keys:
                value = infer_partition_value(rows[0], key)
                if value:
                    partition_entries.append((key, value))
        partition_prefix = (
            "/".join(f"{key}={sanitize_path_value(value)}" for key, value in partition_entries) + "/"
            if partition_entries else ""
        )
        filename = f"part-{index:05d}.jsonl" + (".gz" if compression == "gzip" else "")
        relative_path = f"records/{partition_prefix}{filename}"
        target = output_dir / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        byte_size = write_jsonl_rows(target, rows, compression)
        log(
            f"Wrote record shard {index + 1:,}/{max(1, len(record_chunks)):,}: "
            f"{relative_path} ({len(rows):,} rows, {byte_size:,} bytes)"
        )
        shards.append({
            "id": f"records-{index}",
            "kind": "records",
            "path": relative_path,
            "format": "jsonl",
            "compression": compression,
            "rowCount": len(rows),
            "byteSize": byte_size,
            "partitions": {key: value for key, value in partition_entries} or None,
        })

    for index, rows in enumerate(projection_chunks):
        filename = f"part-{index:05d}.jsonl" + (".gz" if compression == "gzip" else "")
        relative_path = f"text-projections/{filename}"
        target = output_dir / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        byte_size = write_jsonl_rows(target, rows, compression)
        log(
            f"Wrote text projection shard {index + 1:,}/{max(1, len(projection_chunks)):,}: "
            f"{relative_path} ({len(rows):,} rows, {byte_size:,} bytes)"
        )
        shards.append({
            "id": f"text-projections-{index}",
            "kind": "text_projections",
            "path": relative_path,
            "format": "jsonl",
            "compression": compression,
            "rowCount": len(rows),
            "byteSize": byte_size,
        })

    manifest = {
        "version": 2,
        "layout": "sharded",
        "implementation": implementation,
        "descriptor": descriptor,
        "storageProfile": {
            "canonicalStore": "object_storage",
            "catalog": "postgres",
            "vectorIndex": "qdrant" if projection_count > 0 else "none",
            "textIndex": "typesense" if projection_count > 0 else "none",
            "tabularFormat": "parquet",
            "textFormat": "jsonl",
            "textCompression": compression,
        },
        "stats": {
            "recordCount": record_count,
            "textProjectionCount": projection_count,
            "shardCount": len(shards),
        },
        "samples": {
            "records": sample_records[:12],
        },
        "shards": shards,
    }
    target = output_dir / "manifest.json"
    target.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    log(f"Wrote manifest to {target}")
    return target


def build_tabular_bundle(args: argparse.Namespace, input_path: Path) -> dict[str, Any]:
    rows = read_tabular_rows(input_path)
    if not rows:
        raise ValueError("Input dataset is empty")

    log(f"Inferring schema from {len(rows):,} tabular rows")
    schema = prepare_tabular_schema(args, rows, input_path)

    records: list[dict[str, Any]] = []
    projections: dict[str, list[dict[str, Any]]] = {}
    for index, row in enumerate(rows):
        record, projection = build_tabular_record(args, row, index, schema)
        records.append(record)
        if projection is not None:
            projections[record["id"]] = [projection]
        if (index + 1) % PROGRESS_ROW_INTERVAL == 0:
            log(
                f"Normalized {index + 1:,}/{len(rows):,} tabular rows "
                f"({len(records):,} records, {sum(len(items) for items in projections.values()):,} text projections)"
            )
    log(
        f"Finished tabular normalization: {len(records):,} records, "
        f"{sum(len(items) for items in projections.values()):,} text projections, {len(schema['numeric_measures']):,} numeric measures"
    )
    return build_bundle(
        args=args,
        descriptor_fields=schema["descriptor_fields"],
        numeric_measures=schema["numeric_measures"],
        records=records,
        projections=projections,
        description=f"Normalized tabular dataset from {input_path.name}",
    )


def build_unstructured_bundle(args: argparse.Namespace, input_path: Path) -> dict[str, Any]:
    files = collect_unstructured_files(input_path)
    log(f"Building unstructured bundle from {len(files):,} files")
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
        if (index + 1) % 100 == 0:
            log(f"Processed {index + 1:,}/{len(files):,} files")

    if not records:
        raise ValueError("No non-empty text documents were extracted")

    log(f"Finished unstructured normalization: {len(records):,} records")

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
    log(
        f"Starting ingest for dataset id={args.id} name={args.name!r} "
        f"input={input_path} mode={mode}"
    )
    if mode == "tabular" and input_path.suffix.lower() == ".parquet":
        result = stream_parquet_to_sharded_instance(args, input_path)
        log("Ingest complete")
        print(json.dumps(result, indent=2))
        return

    bundle = build_tabular_bundle(args, input_path) if mode == "tabular" else build_unstructured_bundle(args, input_path)
    output_dir = Path(args.output_root).expanduser().resolve() / args.id
    target = write_sharded_instance(args, bundle, output_dir)
    log("Ingest complete")
    print(json.dumps({
        "ok": True,
        "mode": mode,
        "path": str(target),
        "records": len(bundle["records"]),
        "textProjectionRecords": sum(
            len(items) for items in (bundle.get("textProjectionsByRecordId") or {}).values()
        ),
        "numericMeasures": len(bundle["descriptor"].get("measures") or []),
        "layout": "sharded",
        "compression": args.compression,
        "shardRecordLimit": args.shard_record_limit,
    }, indent=2))


if __name__ == "__main__":
    main()

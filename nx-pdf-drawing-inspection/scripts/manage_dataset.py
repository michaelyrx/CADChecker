#!/usr/bin/env python3
"""Register, list, validate, approve, and bind managed CAD datasets."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from _common import load_json, relative_to, require_id, require_version, sha256_file, utc_now, write_json


def registry(root: Path) -> tuple[Path, dict]:
    path = root / "dataset-registry.json"
    data = load_json(path, {"schema_version": "1.0", "datasets": []})
    return path, data


def find_record(data: dict, dataset_id: str, version: str | None = None) -> dict:
    matches = [item for item in data["datasets"] if item["dataset_id"] == dataset_id and (version is None or item["version"] == version)]
    if not matches:
        raise SystemExit(f"Dataset not found: {dataset_id} {version or ''}".strip())
    return sorted(matches, key=lambda item: [int(x) for x in item["version"].split(".")])[-1]


def register(args: argparse.Namespace) -> None:
    dataset_id = require_id(args.dataset_id, "dataset ID")
    version = require_version(args.version)
    source = args.source.expanduser().resolve()
    if not source.exists():
        raise SystemExit(f"Source does not exist: {source}")
    path, data = registry(args.root)
    if any(item["dataset_id"] == dataset_id and item["version"] == version for item in data["datasets"]):
        raise SystemExit(f"Dataset version already registered: {dataset_id} {version}")
    kind_dir = "baselines" if args.type == "baseline" else "targets"
    dataset_dir = args.root / kind_dir / dataset_id
    for name in ("sources", "manifests", "normalized", "views", "features", "annotations", "relations", "evidence", "versions"):
        (dataset_dir / name).mkdir(parents=True, exist_ok=True)
    record = {
        "dataset_id": dataset_id,
        "type": args.type,
        "version": version,
        "status": "draft" if args.type == "baseline" else "registered",
        "path": relative_to(dataset_dir, args.root),
        "storage_mode": "reference",
        "source_path": str(source),
        "source_sha256": sha256_file(source),
        "source_size": source.stat().st_size,
        "customer": args.customer,
        "project": args.project,
        "part_family": args.part_family,
        "drawing_number": args.drawing_number,
        "revision": args.revision,
        "baseline_dataset_id": args.baseline_id,
        "baseline_version": args.baseline_version,
        "ruleset_id": args.ruleset_id,
        "ruleset_version": args.ruleset_version,
        "created_at": utc_now(),
    }
    if args.type == "target" and (not args.baseline_id or not args.baseline_version):
        raise SystemExit("Target registration requires --baseline-id and --baseline-version")
    write_json(dataset_dir / "dataset.json", record)
    write_json(dataset_dir / "sources" / "source-reference.json", {key: record[key] for key in ("storage_mode", "source_path", "source_sha256", "source_size")})
    write_json(dataset_dir / "versions" / f"v{version}.json", record)
    data["datasets"].append(record)
    write_json(path, data)
    print(json.dumps(record, ensure_ascii=False, indent=2))


def validate(args: argparse.Namespace) -> None:
    _, data = registry(args.root)
    record = find_record(data, args.dataset_id, args.version)
    dataset_dir = args.root / record["path"]
    errors = []
    if not (dataset_dir / "dataset.json").exists():
        errors.append("missing dataset.json")
    source = Path(record["source_path"])
    if not source.exists():
        errors.append("source missing")
    elif sha256_file(source) != record["source_sha256"]:
        errors.append("source hash mismatch")
    if record["type"] == "target" and not record.get("baseline_dataset_id"):
        errors.append("target has no baseline binding")
    result = {"dataset_id": record["dataset_id"], "version": record["version"], "status": "PASS" if not errors else "FAIL", "errors": errors}
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if not errors else 1)


def approve(args: argparse.Namespace) -> None:
    path, data = registry(args.root)
    record = find_record(data, args.dataset_id, args.version)
    if record["type"] != "baseline":
        raise SystemExit("Only baseline datasets can be approved")
    record["status"] = "approved"
    record["approved_by"] = args.approved_by
    record["approved_at"] = utc_now()
    dataset_dir = args.root / record["path"]
    write_json(dataset_dir / "dataset.json", record)
    write_json(dataset_dir / "versions" / f"v{record['version']}.json", record)
    write_json(path, data)
    print(json.dumps(record, ensure_ascii=False, indent=2))


def list_records(args: argparse.Namespace) -> None:
    _, data = registry(args.root)
    items = [item for item in data["datasets"] if not args.type or item["type"] == args.type]
    print(json.dumps(items, ensure_ascii=False, indent=2))


def set_status(args: argparse.Namespace) -> None:
    path, data = registry(args.root)
    record = find_record(data, args.dataset_id, args.version)
    allowed = {
        "baseline": {"draft", "parsed", "reviewed", "approved", "deprecated", "superseded"},
        "target": {"registered", "parsed", "normalized", "matched", "inspected", "reviewed", "closed"},
    }
    if args.status not in allowed[record["type"]]:
        raise SystemExit(f"Invalid {record['type']} status: {args.status}")
    record["status"] = args.status
    record["status_updated_at"] = utc_now()
    dataset_dir = args.root / record["path"]
    write_json(dataset_dir / "dataset.json", record)
    write_json(dataset_dir / "versions" / f"v{record['version']}.json", record)
    write_json(path, data)
    print(json.dumps(record, ensure_ascii=False, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("cad-data"))
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("register")
    p.add_argument("--type", choices=("baseline", "target"), required=True)
    p.add_argument("--dataset-id", required=True)
    p.add_argument("--version", default="1.0.0")
    p.add_argument("--source", type=Path, required=True)
    p.add_argument("--customer", default="")
    p.add_argument("--project", default="")
    p.add_argument("--part-family", default="")
    p.add_argument("--drawing-number", default="")
    p.add_argument("--revision", default="")
    p.add_argument("--baseline-id")
    p.add_argument("--baseline-version")
    p.add_argument("--ruleset-id")
    p.add_argument("--ruleset-version")
    p.set_defaults(func=register)
    p = sub.add_parser("validate")
    p.add_argument("--dataset-id", required=True)
    p.add_argument("--version")
    p.set_defaults(func=validate)
    p = sub.add_parser("approve")
    p.add_argument("--dataset-id", required=True)
    p.add_argument("--version", required=True)
    p.add_argument("--approved-by", required=True)
    p.set_defaults(func=approve)
    p = sub.add_parser("list")
    p.add_argument("--type", choices=("baseline", "target"))
    p.set_defaults(func=list_records)
    p = sub.add_parser("set-status")
    p.add_argument("--dataset-id", required=True)
    p.add_argument("--version", required=True)
    p.add_argument("--status", required=True)
    p.set_defaults(func=set_status)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()

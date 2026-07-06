#!/usr/bin/env python3
"""Create, finalize, and validate immutable CAD inspection audit runs."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from _common import load_json, require_id, sha256_file, utc_now, write_json


RUN_DIRS = {
    "learning": "learning-runs",
    "inspection": "inspection-runs",
    "feedback": "feedback-runs",
    "regression": "regression-runs",
}
INSPECTION_STAGES = ("01_target", "02_vector", "03_normalized", "04_features", "05_annotations", "06_matching", "07_rules", "08_evidence", "09_report", "logs")
LEARNING_STAGES = ("01_target", "02_vector", "03_normalized", "04_features", "05_annotations", "06_baseline-extraction", "07_rule-proposals", "08_evidence", "09_baseline-package", "logs")


def registry(root: Path) -> tuple[Path, dict]:
    path = root / "audit-registry.json"
    return path, load_json(path, {"schema_version": "1.0", "runs": []})


def create(args: argparse.Namespace) -> None:
    run_id = require_id(args.run_id.lower(), "run ID")
    run_dir = args.root / RUN_DIRS[args.type] / run_id
    if run_dir.exists():
        raise SystemExit(f"Run already exists: {run_dir}")
    stages = INSPECTION_STAGES if args.type == "inspection" else LEARNING_STAGES if args.type == "learning" else ("evidence", "logs")
    for stage in stages:
        (run_dir / stage).mkdir(parents=True, exist_ok=True)
    manifest = {
        "run_id": run_id,
        "run_type": args.type,
        "status": "open",
        "skill_version": args.skill_version,
        "baseline": {"id": args.baseline_id, "version": args.baseline_version},
        "target": {"id": args.target_id, "version": args.target_version},
        "ruleset": {"id": args.ruleset_id, "version": args.ruleset_version},
        "parent_run_id": args.parent_run_id,
        "started_at": utc_now(),
        "completed_at": None,
        "result": None,
    }
    write_json(run_dir / "run-manifest.json", manifest)
    path, data = registry(args.root)
    data["runs"].append({"run_id": run_id, "type": args.type, "status": "open", "path": str(run_dir.relative_to(args.root)), "started_at": manifest["started_at"]})
    write_json(path, data)
    print(json.dumps({"run_dir": str(run_dir), "manifest": manifest}, ensure_ascii=False, indent=2))


def checksums(run_dir: Path) -> dict:
    files = {}
    for path in sorted(run_dir.rglob("*")):
        if path.is_file() and path.name != "checksums.json":
            files[str(path.relative_to(run_dir))] = sha256_file(path)
    return {"schema_version": "1.0", "generated_at": utc_now(), "files": files}


def finalize(args: argparse.Namespace) -> None:
    run_dir = args.run_dir.resolve()
    manifest_path = run_dir / "run-manifest.json"
    manifest = load_json(manifest_path)
    if manifest.get("status") == "closed":
        raise SystemExit("Run is already closed")
    manifest["status"] = "closed"
    manifest["completed_at"] = utc_now()
    manifest["result"] = args.result
    write_json(manifest_path, manifest)
    write_json(run_dir / "checksums.json", checksums(run_dir))
    registry_path, data = registry(args.root)
    for item in data["runs"]:
        if item["run_id"] == manifest["run_id"]:
            item.update({"status": "closed", "completed_at": manifest["completed_at"], "result": args.result})
    write_json(registry_path, data)
    print(json.dumps({"run_id": manifest["run_id"], "status": "closed", "result": args.result}, indent=2))


def validate(args: argparse.Namespace) -> None:
    run_dir = args.run_dir.resolve()
    errors = []
    manifest = load_json(run_dir / "run-manifest.json")
    checksum_path = run_dir / "checksums.json"
    if manifest.get("status") == "closed" and not checksum_path.exists():
        errors.append("closed run missing checksums.json")
    if checksum_path.exists():
        expected = load_json(checksum_path)["files"]
        for relative, digest in expected.items():
            path = run_dir / relative
            if not path.exists(): errors.append(f"missing artifact {relative}")
            elif sha256_file(path) != digest: errors.append(f"checksum mismatch {relative}")
    required = INSPECTION_STAGES[:-1] if manifest["run_type"] == "inspection" else LEARNING_STAGES[:-1] if manifest["run_type"] == "learning" else ()
    for stage in required:
        directory = run_dir / stage
        if not directory.exists() or not any(path.is_file() for path in directory.rglob("*")):
            errors.append(f"stage has no artifacts: {stage}")
    print(json.dumps({"run_id": manifest["run_id"], "status": "PASS" if not errors else "FAIL", "errors": errors}, ensure_ascii=False, indent=2))
    raise SystemExit(0 if not errors else 1)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("cad-audit"))
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("create"); p.add_argument("--type", choices=RUN_DIRS, required=True); p.add_argument("--run-id", required=True); p.add_argument("--skill-version", required=True); p.add_argument("--baseline-id"); p.add_argument("--baseline-version"); p.add_argument("--target-id"); p.add_argument("--target-version"); p.add_argument("--ruleset-id"); p.add_argument("--ruleset-version"); p.add_argument("--parent-run-id"); p.set_defaults(func=create)
    p = sub.add_parser("finalize"); p.add_argument("--run-dir", type=Path, required=True); p.add_argument("--result", choices=("PASS", "CONDITIONAL_PASS", "FAIL", "MANUAL_REVIEW"), required=True); p.set_defaults(func=finalize)
    p = sub.add_parser("validate"); p.add_argument("--run-dir", type=Path, required=True); p.set_defaults(func=validate)
    args = parser.parse_args(); args.func(args)


if __name__ == "__main__":
    main()

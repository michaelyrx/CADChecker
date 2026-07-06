#!/usr/bin/env python3
"""Validate, resolve, propose, and release independently managed CAD rulesets."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from _common import load_json, require_id, require_version, sha256_json, utc_now, write_json


VALID_SCOPES = ("global", "nx-pdf", "project", "baseline")
SCOPE_PRIORITY = {"global": 0, "nx-pdf": 1, "project": 2, "baseline": 3, "run-override": 4}


def validate_ruleset(value: dict) -> list[str]:
    errors = []
    for field in ("ruleset_id", "version", "scope", "status", "rules"):
        if field not in value:
            errors.append(f"missing {field}")
    if value.get("scope") not in VALID_SCOPES:
        errors.append("invalid scope")
    seen = set()
    for rule in value.get("rules", []):
        rule_id = rule.get("rule_id")
        if not rule_id:
            errors.append("rule missing rule_id")
        elif rule_id in seen:
            errors.append(f"duplicate rule_id {rule_id}")
        seen.add(rule_id)
    return errors


def registry(root: Path) -> tuple[Path, dict]:
    path = root / "rule-registry.json"
    return path, load_json(path, {"schema_version": "1.0", "rulesets": []})


def validate_cmd(args: argparse.Namespace) -> None:
    value = load_json(args.ruleset)
    errors = validate_ruleset(value)
    print(json.dumps({"status": "PASS" if not errors else "FAIL", "errors": errors, "hash": sha256_json(value)}, indent=2))
    raise SystemExit(0 if not errors else 1)


def resolve(args: argparse.Namespace) -> None:
    effective = {}
    conflicts = []
    sources = []
    for path in args.ruleset:
        value = load_json(path)
        errors = validate_ruleset(value)
        if errors:
            raise SystemExit(f"Invalid ruleset {path}: {errors}")
        if value.get("status") != "released" and not args.allow_unreleased:
            raise SystemExit(f"Ruleset is not released: {path}")
        priority = SCOPE_PRIORITY[value["scope"]]
        sources.append({"path": str(path), "ruleset_id": value["ruleset_id"], "version": value["version"], "hash": sha256_json(value)})
        for rule in value["rules"]:
            key = rule["rule_id"]
            existing = effective.get(key)
            if existing and existing["priority"] == priority and existing["rule"] != rule:
                conflicts.append({"rule_id": key, "sources": [existing["source"], str(path)]})
            elif not existing or priority >= existing["priority"]:
                effective[key] = {"priority": priority, "source": str(path), "rule": rule}
    output = {"schema_version": "1.0", "status": "RULE_CONFLICT" if conflicts else "resolved", "sources": sources, "conflicts": conflicts, "rules": [item["rule"] for item in effective.values()]}
    write_json(args.output, output)
    print(json.dumps({"status": output["status"], "rule_count": len(output["rules"]), "output": str(args.output)}, indent=2))
    raise SystemExit(1 if conflicts else 0)


def propose(args: argparse.Namespace) -> None:
    proposal_id = require_id(args.proposal_id, "proposal ID")
    proposal = {
        "proposal_id": proposal_id,
        "feedback_ids": args.feedback_id,
        "change_type": args.change_type,
        "target_scope": args.target_scope,
        "proposed_rule": load_json(args.rule),
        "regression_run_id": None,
        "status": "pending_regression",
        "created_at": utc_now(),
    }
    output = args.root / "proposals" / f"{proposal_id}.json"
    if output.exists():
        raise SystemExit(f"Proposal already exists: {output}")
    write_json(output, proposal)
    print(json.dumps(proposal, ensure_ascii=False, indent=2))


def release(args: argparse.Namespace) -> None:
    ruleset = load_json(args.ruleset)
    errors = validate_ruleset(ruleset)
    if errors:
        raise SystemExit(f"Invalid ruleset: {errors}")
    require_id(ruleset["ruleset_id"], "ruleset ID")
    require_version(ruleset["version"])
    if ruleset.get("status") == "released":
        raise SystemExit("Input is already released; create a new version")
    if not args.regression_passed:
        raise SystemExit("Release requires --regression-passed")
    ruleset["status"] = "released"
    ruleset["approved_by"] = args.approved_by
    ruleset["approved_at"] = utc_now()
    ruleset["content_sha256"] = sha256_json({k: v for k, v in ruleset.items() if k != "content_sha256"})
    output = args.root / "releases" / ruleset["ruleset_id"] / f"v{ruleset['version']}.json"
    if output.exists():
        raise SystemExit(f"Released version already exists: {output}")
    write_json(output, ruleset)
    registry_path, data = registry(args.root)
    data["rulesets"].append({
        "ruleset_id": ruleset["ruleset_id"], "version": ruleset["version"], "status": "released",
        "scope": ruleset["scope"], "path": str(output.relative_to(args.root)), "content_sha256": ruleset["content_sha256"],
        "approved_by": args.approved_by, "approved_at": ruleset["approved_at"]
    })
    write_json(registry_path, data)
    print(json.dumps(ruleset, ensure_ascii=False, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("cad-rules"))
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("validate"); p.add_argument("--ruleset", type=Path, required=True); p.set_defaults(func=validate_cmd)
    p = sub.add_parser("resolve"); p.add_argument("--ruleset", type=Path, action="append", required=True); p.add_argument("--output", type=Path, required=True); p.add_argument("--allow-unreleased", action="store_true"); p.set_defaults(func=resolve)
    p = sub.add_parser("propose"); p.add_argument("--proposal-id", required=True); p.add_argument("--feedback-id", action="append", required=True); p.add_argument("--change-type", choices=("add_rule", "modify_rule", "modify_threshold", "modify_severity", "add_variant", "deprecate_rule"), required=True); p.add_argument("--target-scope", choices=VALID_SCOPES, required=True); p.add_argument("--rule", type=Path, required=True); p.set_defaults(func=propose)
    p = sub.add_parser("release"); p.add_argument("--ruleset", type=Path, required=True); p.add_argument("--approved-by", required=True); p.add_argument("--regression-passed", action="store_true"); p.set_defaults(func=release)
    args = parser.parse_args(); args.func(args)


if __name__ == "__main__":
    main()

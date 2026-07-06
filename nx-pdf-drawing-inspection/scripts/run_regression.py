#!/usr/bin/env python3
"""Compare actual machine-readable findings with expected regression findings."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from _common import load_json, utc_now, write_json


def keys(value: dict) -> set[tuple[str, str]]:
    findings = value.get("findings", value.get("results", []))
    return {(item["rule_id"], item.get("status", "FAIL")) for item in findings}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expected", type=Path, required=True)
    parser.add_argument("--actual", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    expected, actual = keys(load_json(args.expected)), keys(load_json(args.actual))
    missing, unexpected = sorted(expected - actual), sorted(actual - expected)
    result = {
        "schema_version": "1.0", "generated_at": utc_now(), "status": "PASS" if not missing and not unexpected else "FAIL",
        "expected_count": len(expected), "actual_count": len(actual), "missing": missing, "unexpected": unexpected,
    }
    write_json(args.output, result)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result["status"] == "PASS" else 1)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Record immutable structured user feedback without modifying released rules."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from _common import load_json, require_id, utc_now, write_json


LABELS = ("true_positive", "false_positive", "false_negative", "wrong_diagnosis", "wrong_severity", "wrong_feature_link", "accepted_variant", "needs_clarification")
STAGES = ("vector_parsing", "normalization", "feature_recognition", "annotation_recognition", "annotation_linking", "template_matching", "rule_inspection", "evidence_rendering", "diagnosis")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run-dir", type=Path, required=True)
    parser.add_argument("--feedback-id", required=True)
    parser.add_argument("--source-run-id", required=True)
    parser.add_argument("--result-id", required=True)
    parser.add_argument("--label", choices=LABELS, required=True)
    parser.add_argument("--failed-stage", choices=STAGES, required=True)
    parser.add_argument("--original-result", type=Path, required=True)
    parser.add_argument("--corrected-result", type=Path, required=True)
    parser.add_argument("--evidence", action="append", default=[])
    parser.add_argument("--recorded-by", required=True)
    args = parser.parse_args()
    feedback_id = require_id(args.feedback_id.lower(), "feedback ID")
    output = args.run_dir / "feedback.json"
    if output.exists():
        raise SystemExit(f"Feedback already recorded: {output}")
    feedback = {
        "feedback_id": feedback_id,
        "source_run_id": args.source_run_id,
        "result_id": args.result_id,
        "label": args.label,
        "failed_stage": args.failed_stage,
        "original_result": load_json(args.original_result),
        "corrected_result": load_json(args.corrected_result),
        "evidence": args.evidence,
        "status": "reviewed",
        "recorded_by": args.recorded_by,
        "recorded_at": utc_now(),
    }
    write_json(output, feedback)
    print(json.dumps(feedback, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

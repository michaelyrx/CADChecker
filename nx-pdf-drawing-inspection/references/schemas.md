# Artifact schemas

Use UTF-8 JSON with stable IDs. Coordinates are arrays `[x, y]`; boxes are `[x0, y0, x1, y1]`. Store `coordinate_system` and `units` in every geometry-bearing file.

## Common header

```json
{
  "schema_version": "1.0",
  "run_id": "20260705-001",
  "document_id": "test",
  "coordinate_system": "normalized-drawing",
  "units": "mm"
}
```

## Dataset registry record

```json
{
  "dataset_id": "denso-lever-baseline",
  "type": "baseline",
  "version": "1.0.0",
  "status": "approved",
  "path": "baselines/denso-lever-baseline",
  "storage_mode": "reference",
  "source_path": "/path/to/source.pdf",
  "source_sha256": "...",
  "drawing_number": "...",
  "baseline_dataset_id": null,
  "ruleset_id": "denso-lever-rules",
  "ruleset_version": "1.0.0"
}
```

Targets must set `baseline_dataset_id` and `baseline_version`. Baselines must not set them.

## Baseline package

```json
{
  "baseline_id": "denso-lever-baseline",
  "version": "1.0.0",
  "status": "approved",
  "source_hashes": ["..."],
  "drawing_identity": {},
  "view_templates": [],
  "feature_templates": [],
  "annotation_templates": [],
  "relation_templates": [],
  "ruleset": {"id": "denso-lever-rules", "version": "1.0.0"},
  "thresholds": {},
  "allowed_variants": [],
  "limitations": [],
  "approved_by": "user",
  "approved_at": "..."
}
```

## Ruleset and proposal

```json
{
  "ruleset_id": "denso-lever-rules",
  "version": "1.0.0",
  "scope": "baseline",
  "status": "released",
  "baseline_dataset_id": "denso-lever-baseline",
  "rules": [],
  "source_proposals": [],
  "approved_by": "user",
  "approved_at": "..."
}
```

```json
{
  "proposal_id": "RP-0001",
  "feedback_ids": ["FB-0001"],
  "change_type": "add_rule",
  "target_scope": "global",
  "proposed_rule": {},
  "regression_run_id": null,
  "status": "pending_regression"
}
```

## Run manifest

```json
{
  "run_id": "INS-20260705-0001",
  "run_type": "inspection",
  "status": "closed",
  "skill_version": "1.1.0",
  "baseline": {"id": "denso-lever-baseline", "version": "1.0.0", "hash": "..."},
  "target": {"id": "denso-lever-test-0701", "version": "1.0.0", "hash": "..."},
  "ruleset": {"id": "denso-lever-rules", "version": "1.0.0", "hash": "..."},
  "started_at": "...",
  "completed_at": "...",
  "result": "FAIL",
  "parent_run_id": null
}
```

## Feedback record

```json
{
  "feedback_id": "FB-0001",
  "run_id": "INS-20260705-0001",
  "result_id": "RES-0001",
  "label": "false_negative",
  "original_result": {},
  "corrected_result": {},
  "failed_stage": "annotation_linking",
  "evidence": ["screenshot.png"],
  "status": "reviewed"
}
```

## Feature record

```json
{
  "feature_id": "FEAT-0001",
  "view_id": "VIEW-REAR",
  "type": "circular_boss",
  "geometry_ids": ["G-010", "G-011"],
  "bbox": [10, 20, 30, 40],
  "center": [20, 30],
  "relations": ["concentric:FEAT-0002"],
  "confidence": 0.98
}
```

## Annotation record

```json
{
  "annotation_id": "ANN-0001",
  "view_id": "VIEW-REAR",
  "type": "center_distance",
  "raw_text": "21.7 ±0.2",
  "nominal": 21.7,
  "tolerance": {"upper": 0.2, "lower": -0.2},
  "critical": true,
  "reference": false,
  "graphics": {
    "dimension_line_ids": ["G-101"],
    "extension_line_ids": ["G-102", "G-103"],
    "arrow_ids": ["G-104", "G-105"]
  },
  "candidate_feature_ids": ["FEAT-0001", "FEAT-0002"],
  "confidence": 0.97
}
```

## Annotation-feature link

```json
{
  "link_id": "LINK-0001",
  "annotation_id": "ANN-0001",
  "feature_ids": ["FEAT-0001", "FEAT-0002"],
  "property": "vertical_center_distance",
  "status": "misaligned",
  "measurements": {
    "extension_1_offset_mm": 0.42,
    "extension_2_offset_mm": 0.01,
    "threshold_mm": 0.10
  },
  "confidence": 0.97
}
```

## Match record

```json
{
  "match_id": "MATCH-0001",
  "object_type": "annotation",
  "baseline_id": "ANN-B-001",
  "test_id": "ANN-T-018",
  "status": "relinked",
  "changed_fields": ["graphics.extension_line_1"],
  "confidence": 0.96
}
```

## Rule result

```json
{
  "result_id": "RES-0001",
  "rule_id": "CEN03",
  "status": "FAIL",
  "category": "annotation_attachment",
  "view_id": "VIEW-REAR",
  "object_ids": ["ANN-0001", "FEAT-0001"],
  "baseline": "Extension line aligned to upper center",
  "test": "Extension line offset by 0.42 mm",
  "diagnosis": "Center-distance annotation is attached to the wrong vertical level.",
  "impact": "The controlled feature pair is ambiguous.",
  "severity": "high",
  "confidence": 0.97,
  "evidence_id": "EVD-0001",
  "recommendation": "Move the upper extension line to the upper circle center."
}
```

## Evidence index record

```json
{
  "evidence_id": "EVD-0001",
  "result_ids": ["RES-0001"],
  "page": 1,
  "bbox": [100, 200, 450, 650],
  "files": ["RES-0001_overlay.png", "RES-0001_side_by_side.png"],
  "legend": {"green": "expected", "orange": "actual offset"}
}
```

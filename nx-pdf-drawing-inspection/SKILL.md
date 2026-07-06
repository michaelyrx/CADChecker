---
name: nx-pdf-drawing-inspection
description: Learn, version, inspect, compare, and improve NX-exported engineering drawing PDF baselines with traceable datasets, separately released CAD rules, immutable audit runs, evidence-backed findings, and feedback-driven rule proposals. Use when Codex must register or learn a baseline drawing dataset, register a target dataset, select an approved baseline and released ruleset, parse/normalize vector or scanned CAD PDFs, recognize views/features/dimensions/GD&T/notes, validate annotation-to-geometry links, compare target drawings, render evidence, record user corrections, run regression tests, or publish an auditable check report.
---

# NX PDF Drawing Inspection

Keep skill code, managed data, released rules, and audit outputs separate. Execute the required mode and preserve a traceable artifact at every gate.

## Runtime roots

Resolve paths relative to the workspace root:

```text
skills/nx-pdf-drawing-inspection/  # reusable skill only
cad-data/                          # baseline and target datasets
cad-rules/                         # independent versioned rules
cad-audit/                         # immutable learning/check/feedback/regression runs
```

Never store customer drawings inside the skill. Default source storage to path-plus-SHA-256 reference. Copy sources only when the user explicitly requests managed copies.

## Modes

Select exactly one primary mode:

1. `learn-baseline`: register a baseline, run the learning pipeline, create a draft knowledge package, render recognition evidence, and request approval before release.
2. `inspect-target`: register/bind a target, load one approved baseline version plus one released ruleset, run the inspection pipeline, and publish an audit report.
3. `record-feedback`: append structured true-positive, false-positive, false-negative, diagnosis, severity, link, or accepted-variant feedback without modifying released rules.
4. `propose-rule-update`: convert reviewed feedback into a candidate rule/threshold/variant change.
5. `run-regression`: test a candidate ruleset on approved normal, abnormal, and historical-feedback cases.
6. `release-baseline` or `release-ruleset`: publish only after explicit user approval and successful validation.

Read [workflow.md](references/workflow.md) before acting. Read [rules.md](references/rules.md) for scope, precedence, and lifecycle. Read [schemas.md](references/schemas.md) before writing artifacts. Copy [check-report-template.md](assets/check-report-template.md) for final reports.

## Dataset governance

- Store baselines under `cad-data/baselines/<dataset-id>/` and targets under `cad-data/targets/<dataset-id>/`.
- Register every dataset in `cad-data/dataset-registry.json`.
- Give every dataset immutable source hashes and semantic versions.
- Permit formal inspection only with baseline status `approved`.
- Bind each target to one explicit baseline ID/version.
- Preserve old versions; never update them in place.

## Rule governance

Store rules only under `cad-rules/` with scopes `global`, `nx-pdf`, `project`, and `baseline`. Resolve in this order:

```text
run override > baseline > project > nx-pdf > global
```

Report unresolved collisions as `RULE_CONFLICT`. Use only rulesets with status `released` for formal PASS/FAIL decisions. Feedback creates proposals under `cad-rules/proposals/`; it never edits a released ruleset directly.

## Audit governance

Create a unique directory for every learning, inspection, feedback, and regression run under `cad-audit/`. Record skill version, input hashes, dataset versions, ruleset version/hash, timestamps, status, and result. On finalization, hash every artifact and mark the run closed. Corrections create a new run referencing the old run.

## Learning pipeline

Run in order:

1. Target NX PDF drawing
2. PDF vector parsing
3. Drawing normalization
4. Feature recognition
5. Annotation recognition
6. Baseline knowledge extraction
7. Rule candidate generation
8. Evidence rendering
9. Draft baseline package

Learn document identity, page regions, view templates, feature templates, annotation templates, feature-annotation relations, allowed variants, thresholds, and limitations. Show every low-confidence item and proposed controlling rule before approval.

## Inspection pipeline

Run in order:

1. Target NX PDF drawing
2. PDF vector parsing
3. Drawing normalization
4. Feature recognition
5. Annotation recognition
6. Template matching
7. Rule inspection
8. Evidence rendering
9. Check report

Do not jump from a raster difference directly to a finding. Pixel differences locate candidates; semantic object matching and rules determine findings.

## Operating principles

- Prefer PDF paths/text objects over OCR. Use 300 DPI verification renders and 600 DPI for tiny/rotated/overlapping annotations.
- Preserve source coordinates and reversible transforms to normalized drawing coordinates.
- Separate drawing objects, geometric features, annotations, and relations.
- Assign stable IDs to all datasets, objects, matches, rules, results, and evidence.
- Never infer an unmarked manufacturing dimension from raster pixel length.
- Treat a value and its attachment as independent checks.
- Flag ambiguity; never force a match silently.
- Give every finding severity, confidence, evidence, and recommendation.

## Mandatory annotation-link checks

For every annotation, record owning view, target features, controlled property, arrow/leader/extension attachments, ambiguity, and confidence.

For center distance:

1. Compute both centers from concentric geometry or centerline intersections.
2. Identify both extension lines.
3. Measure each extension-line offset from its intended center.
4. Validate dimension direction and target uniqueness.
5. Fail `CEN03` or `CEN04` when an extension line misses the center beyond the recorded threshold.

Apply equivalent checks to diameter, radius, angular, leader, and GD&T annotations. A correct number attached to the wrong feature is a failure.

## Comparison and result contracts

Use match statuses `matched`, `modified`, `added`, `removed`, `moved`, `relinked`, or `ambiguous`.

Use rule statuses `PASS`, `FAIL`, `WARNING`, `REVIEW`, or `NOT_APPLICABLE`. Every non-pass result must include rule/category, object IDs, baseline/test states, diagnosis, impact, severity, confidence, evidence ID, and recommendation.

## Feedback contract

Accept only structured labels: `true_positive`, `false_positive`, `false_negative`, `wrong_diagnosis`, `wrong_severity`, `wrong_feature_link`, `accepted_variant`, or `needs_clarification`. Preserve original and corrected states plus evidence. Locate the failed pipeline stage before proposing a rule change.

## Confidence guidance

- `0.95-1.00`: unique attachment, clear evidence, cross-view support
- `0.80-0.94`: likely with minor overlap/offset
- `0.60-0.79`: multiple candidates or weak evidence
- `<0.60`: manual review; no definitive failure

## Script routing

Use the bundled scripts for deterministic operations:

```bash
python scripts/manage_dataset.py ...
python scripts/inspect_pdf.py ...
python scripts/render_pdf.py ...
python scripts/compare_renders.py ...
python scripts/manage_rules.py ...
python scripts/manage_audit.py ...
python scripts/record_feedback.py ...
```

## Final response

Lead with disposition and severity counts. State baseline/target/ruleset versions and run ID. Provide findings, evidence links, passed scope, limitations, and manual-review queue. State whether each conclusion came from direct vector objects, rendered evidence, or both.

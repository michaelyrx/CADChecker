# NX PDF Drawing Check Report

## 1. Overall result

| Field | Value |
|---|---|
| Run ID | {{run_id}} |
| Baseline dataset/version | {{baseline_dataset}} |
| Target dataset/version | {{target_dataset}} |
| Ruleset/version | {{ruleset}} |
| Skill version | {{skill_version}} |
| Baseline | {{baseline_file}} |
| Test | {{test_file}} |
| Disposition | {{PASS / CONDITIONAL PASS / FAIL / MANUAL REVIEW}} |
| Critical / High / Medium / Low | {{counts}} |
| Overall confidence | {{confidence}} |

## 2. Scope and method

- Parsing method: {{direct vector / rendered evidence / OCR / combined}}
- Pages and views checked: {{scope}}
- Exclusions: {{exclusions}}
- Quality limitations: {{limitations}}

## 3. Pipeline artifact verification

| Stage | Artifact | Gate result | Notes |
|---|---|---|---|
| Target drawing | {{path}} | {{PASS}} | |
| Vector parsing | {{path}} | {{PASS}} | |
| Normalization | {{path}} | {{PASS}} | |
| Feature recognition | {{path}} | {{PASS}} | |
| Annotation recognition | {{path}} | {{PASS}} | |
| Template matching | {{path}} | {{PASS}} | |
| Rule inspection | {{path}} | {{PASS}} | |
| Evidence rendering | {{path}} | {{PASS}} | |

## 4. Recognized objects

| Category | Count | Confidence | Evidence |
|---|---:|---:|---|
| Views | | | |
| Features | | | |
| Annotations | | | |
| Relations | | | |

## 5. Findings

| Result ID | Rule | View / feature | Baseline | Test | Diagnosis | Severity | Confidence | Evidence |
|---|---|---|---|---|---|---|---:|---|
| | | | | | | | | |

## 6. Passed checks

{{passed_scope_summary}}

## 7. Manual review queue

| Object/result | Reason | Confidence | Suggested review |
|---|---|---:|---|
| | | | |

## 8. Recommendations

{{recommendations}}

## 9. Traceability

- Machine-readable findings: {{rule_results_path}}
- Match matrix: {{match_matrix_path}}
- Evidence index: {{evidence_index_path}}
- Run manifest: {{run_manifest_path}}
- Artifact checksums: {{checksums_path}}
- Feedback entry point: {{feedback_run_path}}

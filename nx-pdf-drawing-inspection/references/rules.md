# Rule catalog

## Contents

1. Document and view rules
2. Geometry and feature rules
3. Annotation attachment rules
4. Center-distance rules
5. GD&T rules
6. Completeness and comparison rules
7. Severity policy
8. Rule scopes and lifecycle

## Document and view rules

| ID | Check |
|---|---|
| DOC01 | Drawing identity, sheet, and revision are resolved. |
| DOC02 | Scale, units, sheet size, and projection method are present or inferable. |
| VIEW01 | Basic-view placement agrees with the declared projection method. |
| VIEW02 | Corresponding feature centers/edges align across orthographic views. |
| VIEW03 | Section/detail labels, source markers, and scales resolve bidirectionally. |
| VIEW04 | Key geometry has sufficient view coverage or an explicit 3D-model dependency. |

## Geometry and feature rules

| ID | Check |
|---|---|
| GEO01 | Repeated-feature quantity equals visible/derived feature count. |
| GEO02 | Stated angular distribution agrees with repeated-feature layout. |
| GEO03 | Concentric/tangent/symmetric relations are geometrically plausible. |
| GEO04 | Cross-view feature correspondence is consistent. |
| GEO05 | Baseline/test visible geometry additions, removals, and moves are classified. |

## Annotation attachment rules

| ID | Check |
|---|---|
| LINK01 | Annotation resolves to one owning view. |
| LINK02 | Dimension extension lines originate at intended features or valid extensions. |
| LINK03 | Arrows contact the intended line/feature. |
| LINK04 | Leaders terminate on the intended edge/surface/feature. |
| LINK05 | Dimension type matches target geometry (diameter, radius, angle, etc.). |
| LINK06 | A moved annotation remains linked to the same semantic target. |
| LINK07 | Overlap/occlusion does not make the annotation ambiguous. |

## Center-distance rules

| ID | Check |
|---|---|
| CEN01 | Both target centers are recoverable from geometry or centerlines. |
| CEN02 | Dimension direction represents horizontal, vertical, or true center distance correctly. |
| CEN03 | First extension line passes through/aligns with its target center. |
| CEN04 | Second extension line passes through/aligns with its target center. |
| CEN05 | Scaled geometric center distance agrees with the stated value where scale is authoritative. |
| CEN06 | Each extension line resolves to a different intended circular feature. |
| CEN07 | Centerline presentation is present and internally aligned where required. |

Set alignment tolerance from normalized line width and parse quality. For direct vector coordinates, start with `max(2 * median_line_width, 0.1 mm)` and record the chosen threshold. For raster fallback, use at least 300 DPI, estimate subpixel line centers, and report the pixel-to-drawing transform. Do not declare CEN03/CEN04 FAIL below 0.80 confidence.

## Diameter, radius, angle, and GD&T rules

| ID | Check |
|---|---|
| DIA01 | Diameter annotation targets a circle/cylinder projection. |
| DIA02 | Diameter leader/dimension direction is geometrically plausible. |
| RAD01 | Radius leader targets one specific arc. |
| RAD02 | Radius leader direction is consistent with the curvature center. |
| ANG01 | Angular extensions attach to the intended two edges/axes. |
| ANG02 | Angular arc center is near the theoretical edge/axis intersection. |
| GDT01 | Feature-control frame has a unique controlled feature. |
| GDT02 | Every referenced datum has a formal datum-feature definition. |
| GDT03 | Section label such as B-B is not accepted as datum B. |
| GDT04 | Tolerance-zone type is compatible with the controlled feature. |
| GDT05 | Baseline/test datum values and order are compared independently. |

## Completeness and comparison rules

| ID | Check |
|---|---|
| CMP01 | Nominal value changes are reported. |
| CMP02 | Tolerance changes are reported separately from nominal changes. |
| CMP03 | Datum/GD&T changes are reported. |
| CMP04 | Added/removed notes and surface requirements are reported. |
| CMP05 | Same text/value with changed attachment is reported as relinked. |
| CMP06 | Geometry differences are separated from annotation-only differences. |
| COMP01 | Functional features have controlling dimensions or explicit 3D control. |
| COMP02 | Duplicate dimensions do not conflict. |
| COMP03 | Reference dimensions agree with controlling dimensions. |
| COMP04 | General tolerance is applicable to otherwise untoleranced dimensions. |

## Severity policy

| Severity | Typical condition |
|---|---|
| critical | critical dimension changed, invalid datum/GD&T, likely assembly failure |
| high | wrong attachment, center-distance misalignment, missing functional control |
| medium | ordinary added dimension/note/chamfer or drafting nonconformance |
| low | reference information, layout issue, non-manufacturing presentation issue |

## Rule scopes and lifecycle

Resolve rule scopes in this order: run override, baseline, project, NX-PDF, global. Report incompatible assertions at the same effective priority as `RULE_CONFLICT`.

Use rule types `exact`, `tolerance`, `presence`, `absence`, `relationship`, `attachment`, `pattern`, `allowed-variant`, and `manual-review`.

Use lifecycle states:

| State | Meaning |
|---|---|
| draft | generated but not reviewed |
| proposed | linked to feedback and awaiting regression |
| tested | regression completed |
| released | approved for formal inspection |
| deprecated | retained for history, not selected by default |
| superseded | replaced by a newer version |

Never mutate a released ruleset. Publish a new semantic version with source feedback, proposal, regression result, approver, timestamp, and content hash.

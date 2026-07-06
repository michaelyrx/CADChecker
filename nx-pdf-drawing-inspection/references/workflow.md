# Inspection workflow

## Contents

1. Stage 1 - Target drawing
2. Stage 2 - Vector parsing
3. Stage 3 - Normalization
4. Stage 4 - Feature recognition
5. Stage 5 - Annotation recognition
6. Stage 6 - Template matching
7. Stage 7 - Rule inspection
8. Stage 8 - Evidence rendering
9. Stage 9 - Check report
10. Baseline learning mode
11. Feedback and release mode

## Runtime separation

Use `cad-data` for baseline/target datasets, `cad-rules` for independent rulesets, and `cad-audit` for immutable process runs. A formal inspection must resolve exact dataset versions and one released ruleset before Stage 1.

## Stage 1 - Target drawing

Create `01_target/manifest.json` for each source. Record path, hash, size, page count, media/crop boxes, rotation, creator, producer, creation date, drawing number, revision, part name, scale, projection method, and parse warnings. Render a thumbnail for identity confirmation.

Gate: confirm source identity and page completeness. Do not compare drawings with unresolved sheet/revision identity without labeling the comparison provisional.

## Stage 2 - Vector parsing

Inventory PDF content streams: path construction/paint operations, text operations, images/forms, clipping, line styles, and transforms. Preserve PDF coordinates. If text is outlined, record that semantic text extraction is unavailable and route those regions to visual recognition.

Produce:

- `02_vector/vector_inventory.json`
- `02_vector/text_inventory.json`
- `02_vector/parse_limitations.json`

Gate: account for visible content. Verify by rendering parsed/normalized content over the source page.

## Stage 3 - Normalization

Normalize origin, rotation, scale, and coordinate direction. Merge collinear fragments, reconstruct circles/arcs where supported, classify line styles, and segment frame/title/revision/tolerance/note/view regions. Store forward and inverse coordinate transforms.

Produce:

- `03_normalized/geometry.json`
- `03_normalized/regions.json`
- `03_normalized/coordinate_map.json`
- `03_normalized/verification_overlay.png`

Gate: no material geometry loss or displacement. Record reconstruction residuals.

## Stage 4 - Feature recognition

Recognize drawing views before part features. Establish projection method, view bounds, view scale, section/detail references, and cross-view alignment. Then recognize part features and relations.

Minimum feature classes:

- circle, arc, hole, cylinder, boss
- slot, pocket, step, flange
- rib, repeated rib, snap fit, hook
- fillet, chamfer, mating surface
- center, axis, centerline, symmetry line

Produce `04_features/views.json`, `features.json`, `relations.json`, and an ID overlay.

Gate: every key view/feature must have a location and confidence. Queue low-confidence objects for review.

## Stage 5 - Annotation recognition

Recognize annotation semantics and graphics separately. A dimension record must include value/tolerance plus dimension line, extension lines, arrows/leaders, and candidate targets.

Run attachment validation:

- linear: extension lines attach to intended surfaces/centers
- center distance: both extension lines align to intended centers
- diameter: leader/line targets a circular feature
- radius: leader targets one arc and is directionally plausible
- angle: extensions attach to the two intended edges/axes
- GD&T: control frame has a controlled feature and every datum is formally defined

Produce annotations, links, unmatched records, and overlays.

Gate: all critical annotations are uniquely linked or explicitly marked ambiguous/unmatched.

## Stage 6 - Template matching

Match in hierarchy order: document, page, view, feature, annotation, relation. Use stable geometry and view context before text proximity. Classify each object as matched, modified, added, removed, moved, relinked, or ambiguous.

Produce view, feature, annotation, and relation match files plus a match matrix.

Gate: every baseline and test object has a status. Do not treat raster pixel difference as a semantic result by itself.

## Stage 7 - Rule inspection

Load the rule catalog. Determine applicability, execute every applicable rule, and emit a result even when the result is PASS. Validate dimensions, attachment, cross-view consistency, GD&T, notes, tolerance coverage, and completeness.

Gate: every FAIL/WARNING/REVIEW references object IDs and a planned evidence ID.

## Stage 8 - Evidence rendering

Render full overview and per-finding crops. Use consistent colors:

- red: baseline-only/removed or failed target
- blue: test-only/added
- magenta: changed region box
- green: computed/expected geometry
- orange: measured deviation

For attachment errors, render the actual target center/edge, expected attachment line, actual extension/leader line, and numeric offset. Create `evidence_index.json` mapping result IDs to files and coordinates.

Gate: a reviewer can confirm every failure without searching the whole sheet.

## Stage 9 - Check report

Copy the report template. Include scope, parsing method, artifact quality, recognized objects, comparison statistics, findings, passed checks, limitations, and manual review. Link every finding to evidence and machine-readable records.

Gate: all report IDs resolve; totals reconcile with rule results; the overall disposition follows severity policy.

## Baseline learning mode

Replace inspection Stages 6-9 with baseline extraction, rule proposal, evidence, and a draft baseline package. Capture view, feature, annotation, relation, threshold, allowed-variant, and limitation templates. Register the package as `draft`, show recognition evidence, and require explicit approval before changing it to `approved`.

Mandatory learning outputs:

- baseline manifest and source hash
- normalized drawing package
- view/feature/annotation/relation templates
- proposed baseline-scoped rules
- low-confidence review queue
- evidence index
- baseline package version record

## Feedback and release mode

Record feedback in a new feedback run. Preserve the original finding, corrected interpretation, label, evidence, user, and timestamp. Determine whether the failure came from parsing, normalization, feature recognition, annotation recognition, linking, matching, rules, evidence, or diagnosis.

Generate a proposal rather than editing released rules. Run regression on approved normal, abnormal, and historical-feedback cases. Publish a new semantic version only after explicit user approval. Preserve previous versions and link the release to feedback/proposal/regression run IDs.

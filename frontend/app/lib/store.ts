import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type Category = { id: string; name: string; createdAt: string };
export type Project = { id: string; name: string; code: string; description: string; categoryId: string; createdAt: string };
export type AiProvider = "deepseek" | "bedrock";
export type SystemSettings = { aiProvider: AiProvider; updatedAt: string };
export type EvidenceRegion = { x: number; y: number; width: number; height: number };
export type PageEvidence = { width: number; height: number; rotation: number; pathRegionCount: number; pathRegions: EvidenceRegion[] };
export type PageInventory = { page: number; pathConstruction: number; pathPaint: number; textOperations: number; xobjectDraws: number; status: "vector_content" | "undetermined"; evidence?: PageEvidence };
export type Analysis = { status: "running" | "succeeded" | "failed"; startedAt: string; completedAt?: string; runId?: string; error?: string; sha256?: string; pageCount?: number; pages?: PageInventory[]; parser?: string };
export type Drawing = { id: string; projectId: string; name: string; size: number; uploadedAt: string; analysis?: Analysis };
export type RuleMetric = "min_path_paints_per_page" | "min_text_ops_per_page" | "max_pages";
export type QualityRule = { code: string; name: string; metric: RuleMetric; threshold: number };
export type RuleDraft = { categoryId: string; baseVersion: number; rules: QualityRule[]; updatedAt: string };
export type RuleRelease = { id: string; categoryId: string; version: number; rules: QualityRule[]; sha256: string; publishedAt: string };
export type CheckResult = { ruleCode: string; ruleName: string; page?: number; observed: number; threshold: number; status: "PASS" | "REVIEW"; evidence?: PageEvidence };
export type RequirementSnapshot = { ruleId: string; revision: number; text: string; sources: EngineeringRuleSource[] };
export type CheckRun = { id: string; projectId: string; drawingId: string; categoryId: string; releaseId: string; releaseVersion: number; releaseSha256: string; analysisRunId: string; sourceSha256: string; createdAt: string; results: CheckResult[]; requirements?: RequirementSnapshot[] };
export type ReviewDecision = "confirmed" | "dismissed" | "follow_up";
export type FindingReview = { id: string; projectId: string; checkRunId: string; resultIndex: number; decision: ReviewDecision; note: string; reviewedAt: string };
export type RequirementDecision = "meets" | "does_not_meet" | "not_applicable" | "follow_up";
export type RequirementReview = { id: string; projectId: string; checkRunId: string; ruleId: string; decision: RequirementDecision; note: string; reviewedAt: string };
export type AdviceContent = { summary: string; possibleCauses: string[]; recommendedActions: string[]; limitations: string };
export type AdviceAttempt = { id: string; projectId: string; checkRunId: string; resultIndex: number; language: "zh-CN" | "en"; status: "running" | "succeeded" | "failed"; model: string; provider?: string; promptVersion: "pdf-input-review-v1"; inputSha256: string; sourceSha256: string; ruleSha256: string; createdAt: string; completedAt?: string; durationMs?: number; usage?: { promptTokens: number; completionTokens: number; totalTokens: number }; content?: AdviceContent; error?: string };
export type EngineeringRuleSource = { drawingId: string; page: number; quote: string; sourceSha256: string; analysisRunId: string };
export type EngineeringRule = { id: string; categoryId: string; text: string; status: "candidate" | "accepted" | "rejected"; revision: number; history: { revision: number; text: string; status: "candidate" | "accepted" | "rejected"; changedAt: string }[]; sources: EngineeringRuleSource[]; extractionRunId: string; createdAt: string; updatedAt: string };
export type EngineeringRuleSuggestion = { id: string; ruleId: string; categoryId: string; ruleRevision: number; originalText: string; instruction: string; proposedText?: string; rationale?: string; status: "succeeded" | "failed"; provider: string; model: string; createdAt: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number }; error?: string };
export type RequirementExtraction = { id: string; drawingId: string; projectId: string; categoryId: string; analysisRunId: string; sourceSha256: string; status: "running" | "succeeded" | "failed" | "skipped"; model: string; provider?: string; promptVersion: "engineering-requirements-v1"; inputSha256?: string; pagesWithText?: number; pagesSubmitted?: number; partialText?: boolean; startedAt: string; completedAt?: string; importedCount?: number; error?: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } };
export type DrawingFactKind = "identity" | "view_label" | "dimension_text" | "gdt_text" | "technical_note";
export type ImageBox = { x: number; y: number; width: number; height: number };
export type VisualPageLocation = { box: EvidenceRegion; pageWidth: number; pageHeight: number };
export type DrawingFact = { id: string; kind: DrawingFactKind; page: number; quote: string; review: "pending" | "confirmed" | "rejected"; confidence: number; geometryLink: "unresolved"; sourceMethod?: "pdf_text" | "vision"; textOrigin?: { x: number; y: number }; nearbyPaths?: { id: string; bbox: EvidenceRegion; distancePt: number }[]; regionId?: string; regionRect?: { x: number; y: number; width: number; height: number }; imageBox?: ImageBox; visualPageLocation?: VisualPageLocation };
export type VisualObservation = { id: string; page: number; regionId: string; regionRect: { x: number; y: number; width: number; height: number }; imageBox?: ImageBox; visualPageLocation?: VisualPageLocation; kind: "view" | "feature" | "annotation_relation"; description: string; confidence: number; review: "pending" | "confirmed" | "rejected"; geometryLink: "unresolved" };
export type BaselinePromptVersion = "baseline-text-v1" | "baseline-hybrid-v2" | "baseline-tiled-v3" | "baseline-provider-v4" | "baseline-observations-v5" | "baseline-nearby-paths-v6" | "baseline-occurrences-v7" | "baseline-visual-boxes-v8" | "baseline-visual-page-v9" | "baseline-immutable-evidence-v10";
export type Baseline = { id: string; projectId: string; categoryId: string; drawingId: string; version: number; status: "draft" | "approved"; analysisRunId: string; sourceSha256: string; model: string; provider?: string; promptVersion: BaselinePromptVersion; inputSha256: string; imageSetId?: string; regionHashes?: Record<string, string>; pagesWithText: number; visionPages?: number[]; partialText: boolean; facts: DrawingFact[]; observations?: VisualObservation[]; limitations: string[]; createdAt: string; approvedAt?: string };
export type BaselineLearningRun = { id: string; projectId: string; drawingId: string; analysisRunId: string; sourceSha256: string; status: "running" | "succeeded" | "failed"; model: string; provider?: string; promptVersion: BaselinePromptVersion; inputSha256: string; imageSetId?: string; startedAt: string; completedAt?: string; baselineId?: string; error?: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } };
export type BaselineDifference = { id: string; status: "matched" | "added" | "removed" | "moved" | "position_changed" | "ambiguous"; kind: DrawingFactKind; baseline?: Pick<DrawingFact, "id" | "page" | "quote" | "sourceMethod" | "textOrigin" | "imageBox" | "visualPageLocation">; target?: Pick<DrawingFact, "id" | "page" | "quote" | "sourceMethod" | "textOrigin" | "imageBox" | "visualPageLocation">; confidence: number; reviewRequired: boolean };
export type BaselineComparison = { id: string; projectId: string; baselineId: string; baselineVersion: number; baselineSha256: string; targetDrawingId: string; targetAnalysisRunId: string; targetSha256: string; status: "running" | "succeeded" | "failed"; model: string; provider?: string; promptVersion: BaselinePromptVersion; inputSha256: string; imageSetId?: string; regionHashes?: Record<string, string>; startedAt: string; completedAt?: string; differences?: BaselineDifference[]; targetFacts?: DrawingFact[]; targetObservations?: VisualObservation[]; visionPages?: number[]; partialText?: boolean; error?: string; usage?: { promptTokens: number; completionTokens: number; totalTokens: number } };
export type BaselineFeedback = { id: string; projectId: string; comparisonId: string; targetType: "difference" | "observation"; targetId: string; label: "true_positive" | "false_positive" | "accepted_variant" | "needs_clarification"; note: string; createdAt: string };
export type ReportFinding = CheckResult & { review: Pick<FindingReview, "id" | "decision" | "note" | "reviewedAt"> | null };
export type ReportRequirement = RequirementSnapshot & { review: Pick<RequirementReview, "id" | "decision" | "note" | "reviewedAt"> | null };
export type ReportSnapshot = { id: string; projectId: string; projectName: string; categoryId: string; categoryName: string; drawingId: string; drawingName: string; checkRunId: string; checkCreatedAt: string; ruleVersion: number; ruleSha256: string; analysisRunId: string; sourceSha256: string; workflowRunId?: string; workflowVersion?: number; workflowSha256?: string; workflowReview?: WorkflowRun["review"]; createdAt: string; scope: "pdf_input_quality_v1" | "pdf_input_quality_with_engineering_review_v1"; status: "pending_review" | "complete"; summary: { pass: number; review: number; confirmed: number; dismissed: number; followUp: number; pending: number }; findings: ReportFinding[]; requirements?: ReportRequirement[]; requirementSummary?: { total: number; pending: number; followUp: number; unmet: number } };
export type WorkflowConfig = { analysisMode: "reuse" | "fresh"; reviewMode: "on_review" | "always" | "off" };
export type WorkflowDraft = { projectId: string; baseVersion: number; config: WorkflowConfig; updatedAt: string };
export type WorkflowRelease = { id: string; projectId: string; version: number; config: WorkflowConfig; sha256: string; publishedAt: string };
export type WorkflowStep = { key: "analyze" | "check" | "review"; status: "pending" | "running" | "succeeded" | "skipped" | "failed" | "waiting"; startedAt?: string; completedAt?: string; detail?: string };
export type WorkflowRun = { id: string; projectId: string; drawingId: string; categoryId: string; workflowReleaseId: string; workflowVersion: number; workflowSha256: string; ruleReleaseId: string; ruleVersion: number; ruleSha256: string; createdAt: string; completedAt?: string; status: "running" | "awaiting_review" | "completed" | "failed"; steps: WorkflowStep[]; checkRunId?: string; sourceSha256?: string; analysisRunId?: string; review?: { decision: "accepted" | "needs_action"; note: string; reviewedAt: string } };
export type Database = { systemSettings?: SystemSettings; categories: Category[]; projects: Project[]; drawings: Drawing[]; ruleDrafts: RuleDraft[]; ruleReleases: RuleRelease[]; checkRuns: CheckRun[]; workflowDrafts: WorkflowDraft[]; workflowReleases: WorkflowRelease[]; workflowRuns: WorkflowRun[]; findingReviews: FindingReview[]; requirementReviews: RequirementReview[]; reports: ReportSnapshot[]; adviceAttempts: AdviceAttempt[]; engineeringRules: EngineeringRule[]; engineeringRuleSuggestions: EngineeringRuleSuggestion[]; requirementExtractions: RequirementExtraction[]; baselines: Baseline[]; baselineLearningRuns: BaselineLearningRun[]; baselineComparisons: BaselineComparison[]; baselineFeedback: BaselineFeedback[] };

export const dataDir = process.env.CADLINT_DATA_DIR || path.join(process.cwd(), ".data");
const dbFile = path.join(dataDir, "database.json");
const empty: Database = { categories: [], projects: [], drawings: [], ruleDrafts: [], ruleReleases: [], checkRuns: [], workflowDrafts: [], workflowReleases: [], workflowRuns: [], findingReviews: [], requirementReviews: [], reports: [], adviceAttempts: [], engineeringRules: [], engineeringRuleSuggestions: [], requirementExtractions: [], baselines: [], baselineLearningRuns: [], baselineComparisons: [], baselineFeedback: [] };
let pending = Promise.resolve();

export async function readDb(): Promise<Database> {
  try {
    const db = JSON.parse(await readFile(dbFile, "utf8"));
    if (!Array.isArray(db.categories) || !Array.isArray(db.projects) || !Array.isArray(db.drawings)) throw new Error("Invalid database");
    return { ...db, ruleDrafts: Array.isArray(db.ruleDrafts) ? db.ruleDrafts : [], ruleReleases: Array.isArray(db.ruleReleases) ? db.ruleReleases : [], checkRuns: Array.isArray(db.checkRuns) ? db.checkRuns : [], workflowDrafts: Array.isArray(db.workflowDrafts) ? db.workflowDrafts : [], workflowReleases: Array.isArray(db.workflowReleases) ? db.workflowReleases : [], findingReviews: Array.isArray(db.findingReviews) ? db.findingReviews : [], requirementReviews: Array.isArray(db.requirementReviews) ? db.requirementReviews : [], reports: Array.isArray(db.reports) ? db.reports : [], adviceAttempts: Array.isArray(db.adviceAttempts) ? db.adviceAttempts : [], engineeringRules: Array.isArray(db.engineeringRules) ? db.engineeringRules : [], engineeringRuleSuggestions: Array.isArray(db.engineeringRuleSuggestions) ? db.engineeringRuleSuggestions : [], requirementExtractions: Array.isArray(db.requirementExtractions) ? db.requirementExtractions : [], baselines: Array.isArray(db.baselines) ? db.baselines : [], baselineLearningRuns: Array.isArray(db.baselineLearningRuns) ? db.baselineLearningRuns : [], baselineComparisons: Array.isArray(db.baselineComparisons) ? db.baselineComparisons : [], baselineFeedback: Array.isArray(db.baselineFeedback) ? db.baselineFeedback : [] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(empty);
    throw error;
  }
}

export function updateDb<T>(change: (db: Database) => T | Promise<T>): Promise<T> {
  const run = pending.then(async () => {
    const db = await readDb();
    const result = await change(db);
    await mkdir(dataDir, { recursive: true });
    const temp = path.join(dataDir, `database-${randomUUID()}.tmp`);
    await writeFile(temp, JSON.stringify(db, null, 2));
    await rename(temp, dbFile);
    return result;
  });
  pending = run.then(() => undefined, () => undefined);
  return run;
}

export function failure(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

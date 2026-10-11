import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type Category = { id: string; name: string; createdAt: string };
export type Project = { id: string; name: string; code: string; description: string; categoryId: string; createdAt: string };
export type PageInventory = { page: number; pathConstruction: number; pathPaint: number; textOperations: number; xobjectDraws: number; status: "vector_content" | "undetermined" };
export type Analysis = { status: "running" | "succeeded" | "failed"; startedAt: string; completedAt?: string; runId?: string; error?: string; sha256?: string; pageCount?: number; pages?: PageInventory[]; parser?: string };
export type Drawing = { id: string; projectId: string; name: string; size: number; uploadedAt: string; analysis?: Analysis };
export type RuleMetric = "min_path_paints_per_page" | "min_text_ops_per_page" | "max_pages";
export type QualityRule = { code: string; name: string; metric: RuleMetric; threshold: number };
export type RuleDraft = { categoryId: string; baseVersion: number; rules: QualityRule[]; updatedAt: string };
export type RuleRelease = { id: string; categoryId: string; version: number; rules: QualityRule[]; sha256: string; publishedAt: string };
export type CheckResult = { ruleCode: string; ruleName: string; page?: number; observed: number; threshold: number; status: "PASS" | "REVIEW" };
export type CheckRun = { id: string; projectId: string; drawingId: string; categoryId: string; releaseId: string; releaseVersion: number; releaseSha256: string; analysisRunId: string; sourceSha256: string; createdAt: string; results: CheckResult[] };
export type ReviewDecision = "confirmed" | "dismissed" | "follow_up";
export type FindingReview = { id: string; projectId: string; checkRunId: string; resultIndex: number; decision: ReviewDecision; note: string; reviewedAt: string };
export type ReportFinding = CheckResult & { review: Pick<FindingReview, "id" | "decision" | "note" | "reviewedAt"> | null };
export type ReportSnapshot = { id: string; projectId: string; projectName: string; categoryId: string; categoryName: string; drawingId: string; drawingName: string; checkRunId: string; checkCreatedAt: string; ruleVersion: number; ruleSha256: string; analysisRunId: string; sourceSha256: string; workflowRunId?: string; workflowVersion?: number; workflowSha256?: string; workflowReview?: WorkflowRun["review"]; createdAt: string; scope: "pdf_input_quality_v1"; status: "pending_review" | "complete"; summary: { pass: number; review: number; confirmed: number; dismissed: number; followUp: number; pending: number }; findings: ReportFinding[] };
export type WorkflowConfig = { analysisMode: "reuse" | "fresh"; reviewMode: "on_review" | "always" | "off" };
export type WorkflowDraft = { projectId: string; baseVersion: number; config: WorkflowConfig; updatedAt: string };
export type WorkflowRelease = { id: string; projectId: string; version: number; config: WorkflowConfig; sha256: string; publishedAt: string };
export type WorkflowStep = { key: "analyze" | "check" | "review"; status: "pending" | "running" | "succeeded" | "skipped" | "failed" | "waiting"; startedAt?: string; completedAt?: string; detail?: string };
export type WorkflowRun = { id: string; projectId: string; drawingId: string; categoryId: string; workflowReleaseId: string; workflowVersion: number; workflowSha256: string; ruleReleaseId: string; ruleVersion: number; ruleSha256: string; createdAt: string; completedAt?: string; status: "running" | "awaiting_review" | "completed" | "failed"; steps: WorkflowStep[]; checkRunId?: string; sourceSha256?: string; analysisRunId?: string; review?: { decision: "accepted" | "needs_action"; note: string; reviewedAt: string } };
export type Database = { categories: Category[]; projects: Project[]; drawings: Drawing[]; ruleDrafts: RuleDraft[]; ruleReleases: RuleRelease[]; checkRuns: CheckRun[]; workflowDrafts: WorkflowDraft[]; workflowReleases: WorkflowRelease[]; workflowRuns: WorkflowRun[]; findingReviews: FindingReview[]; reports: ReportSnapshot[] };

export const dataDir = process.env.CADLINT_DATA_DIR || path.join(process.cwd(), ".data");
const dbFile = path.join(dataDir, "database.json");
const empty: Database = { categories: [], projects: [], drawings: [], ruleDrafts: [], ruleReleases: [], checkRuns: [], workflowDrafts: [], workflowReleases: [], workflowRuns: [], findingReviews: [], reports: [] };
let pending = Promise.resolve();

export async function readDb(): Promise<Database> {
  try {
    const db = JSON.parse(await readFile(dbFile, "utf8"));
    if (!Array.isArray(db.categories) || !Array.isArray(db.projects) || !Array.isArray(db.drawings)) throw new Error("Invalid database");
    return { ...db, ruleDrafts: Array.isArray(db.ruleDrafts) ? db.ruleDrafts : [], ruleReleases: Array.isArray(db.ruleReleases) ? db.ruleReleases : [], checkRuns: Array.isArray(db.checkRuns) ? db.checkRuns : [], workflowDrafts: Array.isArray(db.workflowDrafts) ? db.workflowDrafts : [], workflowReleases: Array.isArray(db.workflowReleases) ? db.workflowReleases : [], workflowRuns: Array.isArray(db.workflowRuns) ? db.workflowRuns : [], findingReviews: Array.isArray(db.findingReviews) ? db.findingReviews : [], reports: Array.isArray(db.reports) ? db.reports : [] };
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

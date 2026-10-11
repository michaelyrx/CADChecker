import { randomUUID } from "node:crypto";
import { analyzeDrawing } from "./analyzer";
import { syncEngineeringRequirements } from "./engineering-requirements";
import { evaluateRules } from "./rules";
import { updateDb, type WorkflowConfig, type WorkflowRun, type WorkflowStep } from "./store";

export function validateWorkflow(value: unknown): WorkflowConfig {
  if (!value || typeof value !== "object") throw new Error("Invalid workflow configuration");
  const input = value as Record<string, unknown>;
  if (input.analysisMode !== "reuse" && input.analysisMode !== "fresh") throw new Error("Invalid analysis mode");
  if (input.reviewMode !== "on_review" && input.reviewMode !== "always" && input.reviewMode !== "off") throw new Error("Invalid review mode");
  return { analysisMode: input.analysisMode, reviewMode: input.reviewMode };
}

function step(key: WorkflowStep["key"]): WorkflowStep { return { key, status: "pending" }; }

export async function executeWorkflow(projectId: string, drawingId: string): Promise<WorkflowRun> {
  const { run, drawing, rules, reuse } = await updateDb(db => {
    const project = db.projects.find(item => item.id === projectId);
    if (!project) throw new Error("Project not found");
    const drawing = db.drawings.find(item => item.id === drawingId && item.projectId === projectId);
    if (!drawing) throw new Error("Drawing not found in project");
    const stale = db.workflowRuns.filter(item => item.drawingId === drawingId && item.status === "running" && Date.now() - Date.parse(item.createdAt) > 120_000);
    for (const item of stale) {
      const endedAt = new Date().toISOString();
      const active = item.steps.find(value => value.status === "running");
      if (active) { active.status = "failed"; active.completedAt = endedAt; active.detail = "Execution interrupted"; }
      item.status = "failed"; item.completedAt = endedAt;
    }
    if (stale.length && drawing.analysis?.status === "running") drawing.analysis = { status: "failed", startedAt: drawing.analysis.startedAt, completedAt: new Date().toISOString(), error: "Workflow execution interrupted" };
    if (drawing.analysis?.status === "running" && Date.now() - Date.parse(drawing.analysis.startedAt) > 120_000) drawing.analysis = { status: "failed", startedAt: drawing.analysis.startedAt, completedAt: new Date().toISOString(), error: "PDF analysis interrupted" };
    if (db.workflowRuns.some(item => item.drawingId === drawingId && item.status === "running") || drawing.analysis?.status === "running") throw new Error("Drawing is already running");
    const workflow = db.workflowReleases.filter(item => item.projectId === projectId).sort((a, b) => b.version - a.version)[0];
    if (!workflow) throw new Error("No released workflow for this project");
    const release = db.ruleReleases.filter(item => item.categoryId === project.categoryId).sort((a, b) => b.version - a.version)[0];
    if (!release) throw new Error("No released rules for this category");
    const reuse = workflow.config.analysisMode === "reuse" && drawing.analysis?.status === "succeeded";
    const createdAt = new Date().toISOString();
    const run: WorkflowRun = { id: randomUUID(), projectId, drawingId, categoryId: project.categoryId, workflowReleaseId: workflow.id, workflowVersion: workflow.version, workflowSha256: workflow.sha256, ruleReleaseId: release.id, ruleVersion: release.version, ruleSha256: release.sha256, createdAt, status: "running", steps: [step("analyze"), step("check"), step("review")] };
    run.steps[0] = { key: "analyze", status: "running", startedAt: createdAt };
    db.workflowRuns.push(run);
    if (!reuse) drawing.analysis = { status: "running", startedAt: createdAt };
    return { run: structuredClone(run), drawing: structuredClone(drawing), rules: structuredClone(release.rules), reuse };
  });

  try {
    const analysis = reuse ? drawing.analysis! : await analyzeDrawing(drawing);
    const completedAt = new Date().toISOString();
    if (analysis.status !== "succeeded" || !analysis.runId || !analysis.sha256 || !analysis.pages?.length) {
      return updateDb(db => {
        const item = db.workflowRuns.find(value => value.id === run.id)!;
        const source = db.drawings.find(value => value.id === drawingId)!;
        source.analysis = analysis;
        item.steps[0] = { ...item.steps[0], status: "failed", completedAt, detail: analysis.error || "PDF analysis failed" };
        item.steps[1] = { key: "check", status: "skipped", detail: "Analysis failed" };
        item.steps[2] = { key: "review", status: "skipped" };
        item.status = "failed"; item.completedAt = completedAt;
        return structuredClone(item);
      });
    }
    const finished = await updateDb(db => {
      const item = db.workflowRuns.find(value => value.id === run.id)!;
      const source = db.drawings.find(value => value.id === drawingId)!;
      source.analysis = analysis;
      item.steps[0] = { ...item.steps[0], status: "succeeded", completedAt, detail: reuse ? "Reused previous analysis" : "New analysis completed" };
      item.steps[1] = { key: "check", status: "running", startedAt: completedAt };
      const results = evaluateRules(rules, analysis);
      const check = { id: randomUUID(), projectId, drawingId, categoryId: item.categoryId, releaseId: item.ruleReleaseId, releaseVersion: item.ruleVersion, releaseSha256: item.ruleSha256, analysisRunId: analysis.runId!, sourceSha256: analysis.sha256!, createdAt: new Date().toISOString(), results };
      db.checkRuns.push(check);
      item.checkRunId = check.id; item.sourceSha256 = analysis.sha256; item.analysisRunId = analysis.runId;
      item.steps[1] = { ...item.steps[1], status: "succeeded", completedAt: new Date().toISOString(), detail: `${results.filter(result => result.status === "REVIEW").length} need review` };
      const config = db.workflowReleases.find(value => value.id === item.workflowReleaseId)!.config;
      const needsReview = config.reviewMode === "always" || (config.reviewMode === "on_review" && results.some(result => result.status === "REVIEW"));
      item.steps[2] = needsReview ? { key: "review", status: "waiting" } : { key: "review", status: "skipped" };
      item.status = needsReview ? "awaiting_review" : "completed";
      if (!needsReview) item.completedAt = new Date().toISOString();
      return structuredClone(item);
    });
    await syncEngineeringRequirements(drawingId, analysis).catch(() => undefined);
    return finished;
  } catch (error) {
    return updateDb(db => {
      const item = db.workflowRuns.find(value => value.id === run.id)!;
      const source = db.drawings.find(value => value.id === drawingId)!;
      if (source.analysis?.status === "running") source.analysis = { status: "failed", startedAt: run.createdAt, completedAt: new Date().toISOString(), error: "Workflow execution failed" };
      const active = item.steps.find(value => value.status === "running");
      if (active) { active.status = "failed"; active.completedAt = new Date().toISOString(); active.detail = (error as Error).message; }
      for (const pending of item.steps.filter(value => value.status === "pending")) pending.status = "skipped";
      item.status = "failed"; item.completedAt = new Date().toISOString();
      return structuredClone(item);
    });
  }
}

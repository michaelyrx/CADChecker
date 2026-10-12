import { createHash, randomUUID } from "node:crypto";
import { aiConfig, generateAdvice, promptVersion, type AdviceFacts } from "@/app/lib/ai";
import { failure, updateDb, type AdviceAttempt } from "@/app/lib/store";
export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return failure("Invalid JSON"); }
  const input = body as { resultIndex?: unknown; language?: unknown } | null;
  if (!Number.isInteger(input?.resultIndex) || Number(input?.resultIndex) < 0) return failure("Invalid result index");
  if (input?.language !== "zh-CN" && input?.language !== "en") return failure("Invalid language");
  const resultIndex = Number(input.resultIndex);
  const language = input.language;
  const config = await aiConfig();
  let started;
  try {
    started = await updateDb(db => {
      const check = db.checkRuns.find(item => item.id === id);
      if (!check) throw new Error("Check run not found");
      const result = check.results[resultIndex];
      if (!result || result.status !== "REVIEW") throw new Error("Only review results can receive advice");
      const release = db.ruleReleases.find(item => item.id === check.releaseId);
      const rule = release?.rules.find(item => item.code === result.ruleCode);
      if (!rule) throw new Error("Rule source is missing");
      if (db.adviceAttempts.some(item => item.checkRunId === id && item.resultIndex === resultIndex && item.status === "running" && Date.now() - Date.parse(item.createdAt) < 60_000)) throw new Error("Advice already running");
      const facts: AdviceFacts = { scope: "pdf_input_quality_v1", ruleCode: result.ruleCode, metric: rule.metric, ...(result.page ? { page: result.page } : {}), observed: result.observed, threshold: result.threshold, status: "REVIEW" };
      const item: AdviceAttempt = { id: randomUUID(), projectId: check.projectId, checkRunId: id, resultIndex, language, status: "running", model: config.model, provider: config.provider, promptVersion, inputSha256: createHash("sha256").update(JSON.stringify(facts)).digest("hex"), sourceSha256: check.sourceSha256, ruleSha256: check.releaseSha256, createdAt: new Date().toISOString() };
      db.adviceAttempts.push(item);
      return { attempt: item, facts };
    });
  } catch (error) {
    const message = (error as Error).message;
    if (["Check run not found", "Rule source is missing"].includes(message)) return failure(message, 404);
    if (message === "Only review results can receive advice") return failure(message);
    if (message === "Advice already running") return failure(message, 409);
    throw error;
  }
  const startedAt = Date.now();
  try {
    const output = await generateAdvice(started.facts, language, config.provider);
    const attempt = await updateDb(db => {
      const item = db.adviceAttempts.find(value => value.id === started.attempt.id)!;
      item.status = "succeeded"; item.completedAt = new Date().toISOString(); item.durationMs = Date.now() - startedAt; item.content = output.content; item.usage = output.usage;
      return structuredClone(item);
    });
    return Response.json(attempt, { status: 201 });
  } catch (error) {
    const message = (error as Error).message;
    const attempt = await updateDb(db => {
      const item = db.adviceAttempts.find(value => value.id === started.attempt.id)!;
      item.status = "failed"; item.completedAt = new Date().toISOString(); item.durationMs = Date.now() - startedAt; item.error = message;
      return structuredClone(item);
    });
    return Response.json({ error: message, attemptId: attempt.id }, { status: /not configured/.test(message) ? 503 : 502 });
  }
}

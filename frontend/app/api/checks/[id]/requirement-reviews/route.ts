import { randomUUID } from "node:crypto";
import { failure, readDb, updateDb, type RequirementDecision } from "@/app/lib/store";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const decisions: RequirementDecision[] = ["meets", "does_not_meet", "not_applicable", "follow_up"];

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const db = await readDb();
  if (!db.checkRuns.some(item => item.id === id)) return failure("Check run not found", 404);
  return Response.json(db.requirementReviews.filter(item => item.checkRunId === id));
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return failure("Invalid JSON"); }
  const input = body as { ruleId?: unknown; decision?: unknown; note?: unknown } | null;
  if (typeof input?.ruleId !== "string" || !decisions.includes(input.decision as RequirementDecision) || typeof input.note !== "string" || !input.note.trim() || input.note.trim().length > 1000) return failure("Invalid requirement review");
  try {
    const review = await updateDb(db => {
      const check = db.checkRuns.find(item => item.id === id);
      if (!check) throw new Error("Check run not found");
      if (!check.requirements?.some(item => item.ruleId === input.ruleId)) throw new Error("Requirement is not in this check run");
      const item = { id: randomUUID(), projectId: check.projectId, checkRunId: id, ruleId: input.ruleId as string, decision: input.decision as RequirementDecision, note: (input.note as string).trim(), reviewedAt: new Date().toISOString() };
      db.requirementReviews.push(item);
      return structuredClone(item);
    });
    return Response.json(review, { status: 201 });
  } catch (error) {
    const message = (error as Error).message;
    if (message === "Check run not found") return failure(message, 404);
    if (message === "Requirement is not in this check run") return failure(message, 409);
    throw error;
  }
}

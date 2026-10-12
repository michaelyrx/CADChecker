import { randomUUID } from "node:crypto";
import { failure, readDb, updateDb, type BaselineFeedback } from "@/app/lib/store";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const db = await readDb();
  if (!db.baselineComparisons.some(item => item.id === id)) return failure("Comparison not found", 404);
  return Response.json(db.baselineFeedback.filter(item => item.comparisonId === id), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return failure("Invalid JSON"); }
  const input = body as { targetType?: unknown; targetId?: unknown; label?: unknown; note?: unknown } | null;
  if (input?.targetType !== "difference" && input?.targetType !== "observation") return failure("Choose a comparison candidate");
  if (typeof input.targetId !== "string" || !input.targetId) return failure("Candidate ID is required");
  if (!["true_positive", "false_positive", "accepted_variant", "needs_clarification"].includes(String(input.label))) return failure("Invalid feedback label");
  if (typeof input.note !== "string" || input.note.trim().length < 3 || input.note.length > 1000) return failure("Feedback note must contain 3–1000 characters");
  const targetType = input.targetType;
  const targetId = input.targetId;
  const note = input.note.trim();
  const result = await updateDb(db => {
    const comparison = db.baselineComparisons.find(item => item.id === id);
    if (!comparison) return { kind: "error", error: "Comparison not found", status: 404 } as const;
    if (comparison.status !== "succeeded") return { kind: "error", error: "Comparison is not complete", status: 409 } as const;
    const candidates = targetType === "difference" ? comparison.differences : comparison.targetObservations;
    if (!candidates?.some(item => item.id === targetId)) return { kind: "error", error: "Candidate not found", status: 404 } as const;
    const feedback: BaselineFeedback = { id: randomUUID(), projectId: comparison.projectId, comparisonId: id, targetType, targetId, label: input.label as BaselineFeedback["label"], note, createdAt: new Date().toISOString() };
    db.baselineFeedback.push(feedback);
    return { kind: "ok", feedback } as const;
  });
  if (result.kind === "error") return failure(result.error, result.status);
  return Response.json(result.feedback, { status: 201 });
}

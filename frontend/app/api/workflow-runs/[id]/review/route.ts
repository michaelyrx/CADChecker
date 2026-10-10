import { failure, updateDb } from "@/app/lib/store";
export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return failure("Invalid JSON"); }
  const input = body as { decision?: unknown; note?: unknown } | null;
  if (input?.decision !== "accepted" && input?.decision !== "needs_action") return failure("Invalid review decision");
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (note.length > 500) return failure("Review note is too long");
  try {
    const run = await updateDb(db => {
      const item = db.workflowRuns.find(value => value.id === id);
      if (!item) throw new Error("Workflow run not found");
      if (item.status !== "awaiting_review") throw new Error("Workflow is not awaiting review");
      const reviewedAt = new Date().toISOString();
      item.review = { decision: input!.decision as "accepted" | "needs_action", note, reviewedAt };
      item.steps[2] = { key: "review", status: "succeeded", startedAt: reviewedAt, completedAt: reviewedAt, detail: input!.decision as string };
      item.status = "completed"; item.completedAt = reviewedAt;
      return structuredClone(item);
    });
    return Response.json(run);
  } catch (error) {
    const message = (error as Error).message;
    if (message === "Workflow run not found") return failure(message, 404);
    if (message === "Workflow is not awaiting review") return failure(message, 409);
    throw error;
  }
}

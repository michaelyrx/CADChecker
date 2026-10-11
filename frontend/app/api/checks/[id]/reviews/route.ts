import { randomUUID } from "node:crypto";
import { failure, updateDb, type ReviewDecision } from "@/app/lib/store";
export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return failure("Invalid JSON"); }
  const input = body as { resultIndex?: unknown; decision?: unknown; note?: unknown } | null;
  if (!Number.isInteger(input?.resultIndex) || Number(input?.resultIndex) < 0) return failure("Invalid result index");
  if (!["confirmed", "dismissed", "follow_up"].includes(String(input?.decision))) return failure("Invalid review decision");
  const note = typeof input?.note === "string" ? input.note.trim() : "";
  if (note.length < 3 || note.length > 500) return failure("Review note must be 3 to 500 characters");
  try {
    const review = await updateDb(db => {
      const check = db.checkRuns.find(item => item.id === id);
      if (!check) throw new Error("Check run not found");
      const result = check.results[Number(input!.resultIndex)];
      if (!result || result.status !== "REVIEW") throw new Error("Only review results can be reviewed");
      const item = { id: randomUUID(), projectId: check.projectId, checkRunId: id, resultIndex: Number(input!.resultIndex), decision: input!.decision as ReviewDecision, note, reviewedAt: new Date().toISOString() };
      db.findingReviews.push(item);
      return item;
    });
    return Response.json(review, { status: 201 });
  } catch (error) {
    const message = (error as Error).message;
    if (message === "Check run not found") return failure(message, 404);
    if (message === "Only review results can be reviewed") return failure(message);
    throw error;
  }
}

import { verifiedManualFact } from "@/app/lib/baselines";
import { failure, readDb, updateDb, type DrawingFactKind } from "@/app/lib/store";
export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return failure("Invalid JSON"); }
  const input = body as { action?: unknown; factId?: unknown; review?: unknown; page?: unknown; kind?: unknown; quote?: unknown } | null;
  if (input?.action !== "review" && input?.action !== "approve" && input?.action !== "add") return failure("Invalid baseline action");
  if (input.action === "review" && (typeof input.factId !== "string" || !["confirmed", "rejected"].includes(String(input.review)))) return failure("Invalid fact review");
  if (input.action === "add" && (typeof input.page !== "number" || typeof input.kind !== "string" || typeof input.quote !== "string")) return failure("Invalid drawing fact");
  try {
    const current = input.action === "add" ? (await readDb()).baselines.find(item => item.id === id) : undefined;
    if (input.action === "add" && !current) return failure("Baseline not found", 404);
    const added = current ? await verifiedManualFact(current, input.page as number, input.kind as DrawingFactKind, input.quote as string) : null;
    const baseline = await updateDb(db => {
      const item = db.baselines.find(value => value.id === id);
      if (!item) throw new Error("Baseline not found");
      if (item.status !== "draft") throw new Error("Approved baseline cannot be changed");
      if (input.action === "add") {
        if (!added) throw new Error("Invalid drawing fact");
        if (item.facts.some(value => value.page === added.page && value.kind === added.kind && value.quote.toLocaleLowerCase() === added.quote.toLocaleLowerCase())) throw new Error("Fact already exists");
        item.facts.push(added);
      } else if (input.action === "review") {
        const fact = item.facts.find(value => value.id === input.factId);
        if (!fact) throw new Error("Fact not found");
        fact.review = input.review as "confirmed" | "rejected";
      } else {
        if (!item.facts.length || item.facts.some(value => value.review === "pending") || !item.facts.some(value => value.review === "confirmed")) throw new Error("Review every fact and confirm at least one before approval");
        item.status = "approved";
        item.approvedAt = new Date().toISOString();
      }
      return structuredClone(item);
    });
    return Response.json(baseline);
  } catch (error) {
    const message = (error as Error).message;
    if (message === "Baseline not found" || message === "Fact not found") return failure(message, 404);
    if (["Approved baseline cannot be changed", "Review every fact and confirm at least one before approval", "Fact already exists"].includes(message)) return failure(message, 409);
    if (["Invalid drawing fact", "Fact quote is not in the PDF text", "Analysis text source is invalid"].includes(message)) return failure(message);
    throw error;
  }
}

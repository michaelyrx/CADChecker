import { failure, updateDb } from "@/app/lib/store";
export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return failure("Invalid JSON"); }
  const input = body as { status?: unknown; text?: unknown; expectedRevision?: unknown } | null;
  if (input?.status !== "candidate" && input?.status !== "accepted" && input?.status !== "rejected") return failure("Invalid rule status");
  if (input.text !== undefined && (typeof input.text !== "string" || input.text.trim().length < 8 || input.text.trim().length > 500)) return failure("Invalid rule text");
  if (input.expectedRevision !== undefined && !Number.isInteger(input.expectedRevision)) return failure("Invalid rule revision");
  try {
    const rule = await updateDb(db => {
      const item = db.engineeringRules.find(value => value.id === id);
      if (!item) throw new Error("Engineering rule not found");
      if (input.expectedRevision !== undefined && item.revision !== input.expectedRevision) throw new Error("Rule was updated; reload before saving");
      const nextText = typeof input.text === "string" ? input.text.trim() : item.text;
      if (item.status === input.status && item.text === nextText) return structuredClone(item);
      item.history ||= [];
      item.revision ||= 1;
      item.history.push({ revision: item.revision, status: item.status, text: item.text, changedAt: item.updatedAt });
      item.revision += 1;
      item.status = input.status as "candidate" | "accepted" | "rejected";
      item.text = nextText;
      item.updatedAt = new Date().toISOString();
      return structuredClone(item);
    });
    return Response.json(rule);
  } catch (error) {
    if ((error as Error).message === "Engineering rule not found") return failure("Engineering rule not found", 404);
    if ((error as Error).message === "Rule was updated; reload before saving") return failure("Rule was updated; reload before saving", 409);
    throw error;
  }
}

import { compareWithBaseline } from "@/app/lib/baselines";
import { failure, readDb } from "@/app/lib/store";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const db = await readDb();
  if (!db.projects.some(item => item.id === id)) return failure("Project not found", 404);
  return Response.json(db.baselineComparisons.filter(item => item.projectId === id).slice().reverse());
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return failure("Invalid JSON"); }
  const input = body as { baselineId?: unknown; targetDrawingId?: unknown } | null;
  if (typeof input?.baselineId !== "string" || typeof input.targetDrawingId !== "string") return failure("Baseline and target drawing are required");
  try { return Response.json(await compareWithBaseline(id, input.baselineId, input.targetDrawingId), { status: 201 }); }
  catch (error) {
    const message = (error as Error).message;
    if (["Approved baseline not found", "Target drawing not found"].includes(message)) return failure(message, 404);
    if (["Target analysis is required", "No readable PDF content", "Analysis text source is invalid", "PDF page rendering failed", "Rendered PDF page is too large"].includes(message)) return failure(message, 409);
    throw error;
  }
}

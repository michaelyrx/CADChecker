import { failure, readDb } from "@/app/lib/store";
import { executeWorkflow } from "@/app/lib/workflow";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await readDb();
  if (!db.projects.some(item => item.id === id)) return failure("Project not found", 404);
  return Response.json(db.workflowRuns.filter(item => item.projectId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return failure("Invalid JSON"); }
  const drawingId = (body as { drawingId?: unknown })?.drawingId;
  if (typeof drawingId !== "string" || !drawingId) return failure("Drawing is required");
  try { return Response.json(await executeWorkflow(id, drawingId), { status: 201 }); }
  catch (error) {
    const message = (error as Error).message;
    if (["Project not found", "Drawing not found in project"].includes(message)) return failure(message, 404);
    if (["Drawing is already running", "No released workflow for this project", "No released rules for this category"].includes(message)) return failure(message, 409);
    throw error;
  }
}

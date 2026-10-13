import { after } from "next/server";
import { startBaselineLearning } from "@/app/lib/baselines";
import { failure, readDb } from "@/app/lib/store";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const db = await readDb();
  if (!db.projects.some(item => item.id === id)) return failure("Project not found", 404);
  return Response.json({ baselines: db.baselines.filter(item => item.projectId === id).sort((a, b) => b.version - a.version), learningRuns: db.baselineLearningRuns.filter(item => item.projectId === id).slice().reverse() });
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return failure("Invalid JSON"); }
  const drawingId = (body as { drawingId?: unknown } | null)?.drawingId;
  if (typeof drawingId !== "string" || !drawingId) return failure("Drawing is required");
  try {
    const { run, perform } = await startBaselineLearning(id, drawingId);
    after(perform);
    return Response.json(run, { status: 202 });
  }
  catch (error) {
    const message = (error as Error).message;
    if (message === "Drawing not found in project") return failure(message, 404);
    if (message === "AI provider is not configured") return failure(message, 503);
    if (["Drawing analysis is required", "Baseline learning already running", "No readable PDF content", "Analysis text source is invalid", "PDF page rendering failed", "PDF region rendering failed", "Invalid rendered JPEG", "Rendered JPEG dimensions are unavailable"].includes(message) || message.startsWith("Rendered PDF region")) return failure(message, 409);
    if (/^(DeepSeek|Bedrock|AI) /.test(message)) return failure(message, 502);
    throw error;
  }
}

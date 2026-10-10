import { analyzeDrawing } from "@/app/lib/analyzer";
import { failure, readDb, updateDb } from "@/app/lib/store";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await readDb();
  const drawing = db.drawings.find(d => d.id === id);
  if (!drawing) return failure("Drawing not found", 404);
  return Response.json(drawing.analysis || { status: "not_started" });
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let drawing;
  try {
    drawing = await updateDb(db => {
      const item = db.drawings.find(d => d.id === id);
      if (!item) throw new Error("Drawing not found");
      if (item.analysis?.status === "running" && Date.now() - Date.parse(item.analysis.startedAt) < 120_000) throw new Error("Analysis already running");
      item.analysis = { status: "running", startedAt: new Date().toISOString() };
      return { ...item };
    });
  } catch (error) {
    if ((error as Error).message === "Drawing not found") return failure("Drawing not found", 404);
    if ((error as Error).message === "Analysis already running") return failure("Analysis already running", 409);
    throw error;
  }
  const result = await analyzeDrawing(drawing);
  await updateDb(db => {
    const item = db.drawings.find(d => d.id === id);
    if (item) item.analysis = result;
  });
  return Response.json(result);
}

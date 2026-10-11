import { syncEngineeringRequirements } from "@/app/lib/engineering-requirements";
import { failure, readDb } from "@/app/lib/store";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const db = await readDb();
  if (!db.drawings.some(item => item.id === id)) return failure("Drawing not found", 404);
  return Response.json([...db.requirementExtractions].reverse().find(item => item.drawingId === id) || null);
}

export async function POST(_request: Request, { params }: Context) {
  const { id } = await params;
  const db = await readDb();
  const drawing = db.drawings.find(item => item.id === id);
  if (!drawing) return failure("Drawing not found", 404);
  if (drawing.analysis?.status !== "succeeded") return failure("Drawing analysis is required", 409);
  try { return Response.json(await syncEngineeringRequirements(id, drawing.analysis, true)); }
  catch (error) { return failure((error as Error).message === "Analysis text source is invalid" ? "Reanalyze drawing to extract text" : "Requirement extraction failed", 409); }
}

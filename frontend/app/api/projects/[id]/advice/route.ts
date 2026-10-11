import { failure, readDb } from "@/app/lib/store";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await readDb();
  if (!db.projects.some(item => item.id === id)) return failure("Project not found", 404);
  return Response.json(db.adviceAttempts.filter(item => item.projectId === id).reverse());
}

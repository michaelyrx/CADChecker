import { failure, readDb } from "@/app/lib/store";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await readDb();
  if (!db.projects.some(p => p.id === id)) return failure("Project not found", 404);
  return Response.json(db.checkRuns.filter(r => r.projectId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

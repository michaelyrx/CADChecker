import { createReportSnapshot } from "@/app/lib/reports";
import { failure, readDb, updateDb } from "@/app/lib/store";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await readDb();
  if (!db.projects.some(item => item.id === id)) return failure("Project not found", 404);
  return Response.json(db.reports.filter(item => item.projectId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return failure("Invalid JSON"); }
  const checkRunId = (body as { checkRunId?: unknown })?.checkRunId;
  if (typeof checkRunId !== "string" || !checkRunId) return failure("Check run is required");
  try {
    const report = await updateDb(db => {
      const item = createReportSnapshot(db, id, checkRunId);
      db.reports.push(item);
      return item;
    });
    return Response.json(report, { status: 201 });
  } catch (error) {
    const message = (error as Error).message;
    if (["Project not found", "Check run not found in project", "Report source is missing"].includes(message)) return failure(message, 404);
    throw error;
  }
}

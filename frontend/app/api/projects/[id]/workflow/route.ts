import { failure, readDb, updateDb } from "@/app/lib/store";
import { validateWorkflow } from "@/app/lib/workflow";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const db = await readDb();
  if (!db.projects.some(item => item.id === id)) return failure("Project not found", 404);
  const releases = db.workflowReleases.filter(item => item.projectId === id).sort((a, b) => b.version - a.version);
  return Response.json({ draft: db.workflowDrafts.find(item => item.projectId === id) || null, latest: releases[0] || null, releases });
}

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return failure("Invalid JSON"); }
  let config;
  try { config = validateWorkflow((body as { config?: unknown })?.config); } catch (error) { return failure((error as Error).message); }
  try {
    const draft = await updateDb(db => {
      if (!db.projects.some(item => item.id === id)) throw new Error("Project not found");
      const latest = db.workflowReleases.filter(item => item.projectId === id).sort((a, b) => b.version - a.version)[0];
      const item = { projectId: id, baseVersion: latest?.version || 0, config, updatedAt: new Date().toISOString() };
      db.workflowDrafts = db.workflowDrafts.filter(value => value.projectId !== id).concat(item);
      return item;
    });
    return Response.json(draft);
  } catch (error) {
    if ((error as Error).message === "Project not found") return failure("Project not found", 404);
    throw error;
  }
}

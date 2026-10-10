import { createHash, randomUUID } from "node:crypto";
import { failure, updateDb } from "@/app/lib/store";
export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const release = await updateDb(db => {
      if (!db.projects.some(item => item.id === id)) throw new Error("Project not found");
      const draft = db.workflowDrafts.find(item => item.projectId === id);
      if (!draft) throw new Error("Save a workflow draft before publishing");
      const latest = db.workflowReleases.filter(item => item.projectId === id).sort((a, b) => b.version - a.version)[0];
      if (draft.baseVersion !== (latest?.version || 0)) throw new Error("Draft is based on an older version");
      const sha256 = createHash("sha256").update(JSON.stringify(draft.config)).digest("hex");
      if (sha256 === latest?.sha256) throw new Error("Workflow is unchanged");
      const item = { id: randomUUID(), projectId: id, version: (latest?.version || 0) + 1, config: structuredClone(draft.config), sha256, publishedAt: new Date().toISOString() };
      db.workflowReleases.push(item);
      db.workflowDrafts = db.workflowDrafts.filter(value => value.projectId !== id);
      return item;
    });
    return Response.json(release, { status: 201 });
  } catch (error) {
    const message = (error as Error).message;
    if (message === "Project not found") return failure(message, 404);
    if (["Save a workflow draft before publishing", "Draft is based on an older version", "Workflow is unchanged"].includes(message)) return failure(message, 409);
    throw error;
  }
}

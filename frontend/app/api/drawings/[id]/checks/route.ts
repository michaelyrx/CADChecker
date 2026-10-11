import { randomUUID } from "node:crypto";
import { snapshotEngineeringRequirements } from "@/app/lib/engineering-review";
import { evaluateRules } from "@/app/lib/rules";
import { failure, updateDb } from "@/app/lib/store";
export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const run = await updateDb(db => {
      const drawing = db.drawings.find(d => d.id === id);
      if (!drawing) throw new Error("Drawing not found");
      const project = db.projects.find(p => p.id === drawing.projectId);
      if (!project) throw new Error("Project not found");
      const analysis = drawing.analysis;
      if (analysis?.status !== "succeeded" || !analysis.runId || !analysis.sha256 || !analysis.pages?.length) throw new Error("Drawing analysis is required");
      const release = db.ruleReleases.filter(r => r.categoryId === project.categoryId).sort((a, b) => b.version - a.version)[0];
      if (!release) throw new Error("No released rules for this category");
      const item = { id: randomUUID(), projectId: project.id, drawingId: id, categoryId: project.categoryId, releaseId: release.id, releaseVersion: release.version, releaseSha256: release.sha256, analysisRunId: analysis.runId, sourceSha256: analysis.sha256, createdAt: new Date().toISOString(), results: evaluateRules(release.rules, analysis), requirements: snapshotEngineeringRequirements(db, project.categoryId) };
      db.checkRuns.push(item);
      return item;
    });
    return Response.json(run, { status: 201 });
  } catch (error) {
    const message = (error as Error).message;
    if (["Drawing not found", "Project not found"].includes(message)) return failure(message, 404);
    if (["Drawing analysis is required", "No released rules for this category"].includes(message)) return failure(message, 409);
    throw error;
  }
}

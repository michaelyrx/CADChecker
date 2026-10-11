import { readFile } from "node:fs/promises";
import path from "node:path";
import { dataDir, failure, readDb } from "@/app/lib/store";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; regionId: string }> }) {
  const { id, regionId } = await params;
  if (!/^p[1-9]\d*-r[1-9]\d*$/.test(regionId)) return failure("Invalid PDF region", 400);
  const run = (await readDb()).baselineComparisons.find(item => item.id === id);
  if (!run || !run.targetObservations?.some(item => item.regionId === regionId) && !run.targetFacts?.some(item => item.sourceMethod === "vision" && item.regionId === regionId)) return failure("PDF region not found", 404);
  try {
    const bytes = await readFile(path.join(dataDir, "analysis", run.targetDrawingId, run.targetAnalysisRunId, "vision", `${regionId}.jpg`));
    return new Response(bytes, { headers: { "Content-Type": "image/jpeg", "Content-Disposition": "inline", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return failure("PDF region file not found", 404);
    throw error;
  }
}

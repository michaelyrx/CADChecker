import { failure, readDb } from "@/app/lib/store";
import { readVisualRegion, RegionIntegrityError } from "@/app/lib/visual-evidence";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; regionId: string }> }) {
  const { id, regionId } = await params;
  if (!/^p[1-9]\d*-r[1-9]\d*$/.test(regionId)) return failure("Invalid PDF region", 400);
  const run = (await readDb()).baselineComparisons.find(item => item.id === id);
  if (!run || !run.targetObservations?.some(item => item.regionId === regionId) && !run.targetFacts?.some(item => item.sourceMethod === "vision" && item.regionId === regionId)) return failure("PDF region not found", 404);
  try {
    const bytes = await readVisualRegion({ drawingId: run.targetDrawingId, analysisRunId: run.targetAnalysisRunId, imageSetId: run.imageSetId, regionHashes: run.regionHashes }, regionId);
    return new Response(bytes, { headers: { "Content-Type": "image/jpeg", "Content-Disposition": "inline", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if (error instanceof RegionIntegrityError) return failure(error.message, 409);
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return failure("PDF region file not found", 404);
    throw error;
  }
}

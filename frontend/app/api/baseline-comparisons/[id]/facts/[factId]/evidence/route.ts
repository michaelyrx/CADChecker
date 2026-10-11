import { factEvidence } from "@/app/lib/fact-evidence";
import { failure, readDb } from "@/app/lib/store";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; factId: string }> }) {
  const { id, factId } = await params;
  const comparison = (await readDb()).baselineComparisons.find(item => item.id === id && item.status === "succeeded");
  const fact = comparison?.targetFacts?.find(item => item.id === factId);
  if (!comparison || !fact) return failure("Target fact not found", 404);
  if (!fact.textOrigin) return failure("Fact has no locatable PDF text", 409);
  try { return await factEvidence({ drawingId: comparison.targetDrawingId, analysisRunId: comparison.targetAnalysisRunId, sourceSha256: comparison.targetSha256 }, fact); }
  catch { return failure("PDF evidence rendering failed", 422); }
}

import { RegionIntegrityError, visualEvidence } from "@/app/lib/visual-evidence";
import { failure, readDb } from "@/app/lib/store";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; candidateId: string }> }) {
  const { id, candidateId } = await params;
  const baseline = (await readDb()).baselines.find(item => item.id === id);
  const candidate = baseline?.facts.find(item => item.id === candidateId && item.sourceMethod === "vision") || baseline?.observations?.find(item => item.id === candidateId);
  if (!baseline || !candidate) return failure("Visual candidate not found", 404);
  if (!candidate.imageBox) return failure("Visual candidate has no precise location", 409);
  try { return await visualEvidence(baseline, { regionId: candidate.regionId!, imageBox: candidate.imageBox }); }
  catch (error) { return error instanceof RegionIntegrityError ? failure(error.message, 409) : failure("Visual evidence rendering failed", 422); }
}

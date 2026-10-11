import { factEvidence } from "@/app/lib/fact-evidence";
import { failure, readDb } from "@/app/lib/store";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; factId: string }> }) {
  const { id, factId } = await params;
  const baseline = (await readDb()).baselines.find(item => item.id === id);
  const fact = baseline?.facts.find(item => item.id === factId);
  if (!baseline || !fact) return failure("Fact not found", 404);
  if (!fact.textOrigin) return failure("Fact has no locatable PDF text", 409);
  try { return await factEvidence(baseline, fact); }
  catch { return failure("PDF evidence rendering failed", 422); }
}

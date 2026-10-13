import { readFile } from "node:fs/promises";
import path from "node:path";
import { dataDir, type Baseline, type DrawingFact, type EvidenceRegion, type PathAssociation } from "./store";

const sameBox = (left: EvidenceRegion, right: unknown) => {
  if (!right || typeof right !== "object") return false;
  const box = right as Partial<EvidenceRegion>;
  return ["x", "y", "width", "height"].every(key => Number.isFinite(box[key as keyof EvidenceRegion]) && left[key as keyof EvidenceRegion] === box[key as keyof EvidenceRegion]);
};

export async function verifiedPathAssociation(baseline: Baseline, fact: DrawingFact, pathId: string): Promise<PathAssociation> {
  if (fact.review !== "confirmed" || fact.sourceMethod !== "pdf_text" || !fact.textOrigin || !["dimension_text", "gdt_text", "technical_note"].includes(fact.kind)) throw new Error("Confirm a locatable annotation before linking a path");
  const candidate = fact.nearbyPaths?.find(item => item.id === pathId);
  if (!candidate) throw new Error("Path is not a candidate for this annotation");
  const file = path.join(dataDir, "analysis", baseline.drawingId, baseline.analysisRunId, "vectors.json");
  let vectors: { source_sha256?: unknown; pages?: { page?: unknown; vector_objects?: { id?: unknown; bbox?: unknown }[] }[] };
  try { vectors = JSON.parse(await readFile(file, "utf8")); }
  catch { throw new Error("Analysis vector source is invalid"); }
  if (vectors.source_sha256 !== baseline.sourceSha256 || !Array.isArray(vectors.pages)) throw new Error("Analysis vector source is invalid");
  const page = vectors.pages.find((item: { page?: unknown }) => item.page === fact.page);
  const vector = page?.vector_objects?.find((item: { id?: unknown }) => item.id === pathId);
  if (!vector || !sameBox(candidate.bbox, vector.bbox)) throw new Error("Path candidate no longer matches the analysis source");
  return { pathId, bbox: structuredClone(candidate.bbox), analysisRunId: baseline.analysisRunId, sourceSha256: baseline.sourceSha256, confirmedAt: new Date().toISOString() };
}

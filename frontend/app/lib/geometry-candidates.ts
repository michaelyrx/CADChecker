import type { DrawingFact, EvidenceRegion } from "./store";

export type VectorPage = { page: number; vector_objects?: { id?: unknown; bbox?: unknown }[] };

function validBox(value: unknown): value is EvidenceRegion {
  if (!value || typeof value !== "object") return false;
  const box = value as Partial<EvidenceRegion>;
  return [box.x, box.y, box.width, box.height].every(item => typeof item === "number" && Number.isFinite(item)) && box.width! > 0 && box.height! > 0;
}

export function nearbyVectorPaths(fact: DrawingFact, pages: VectorPage[]) {
  if (fact.sourceMethod !== "pdf_text" || !fact.textOrigin || !Number.isFinite(fact.textOrigin.x) || !Number.isFinite(fact.textOrigin.y)) return [];
  const vectors = pages.find(item => item.page === fact.page)?.vector_objects;
  if (!Array.isArray(vectors)) return [];
  return vectors.flatMap(item => {
    if (typeof item.id !== "string" || !validBox(item.bbox)) return [];
    const box = item.bbox;
    const dx = Math.max(box.x - fact.textOrigin!.x, 0, fact.textOrigin!.x - box.x - box.width);
    const dy = Math.max(box.y - fact.textOrigin!.y, 0, fact.textOrigin!.y - box.y - box.height);
    const distance = Math.hypot(dx, dy);
    return distance <= 24 ? [{ id: item.id, bbox: box, distancePt: Math.round(distance * 10) / 10 }] : [];
  }).sort((a, b) => a.distancePt - b.distancePt || a.id.localeCompare(b.id)).slice(0, 3);
}

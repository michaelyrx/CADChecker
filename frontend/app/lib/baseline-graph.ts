import { createHash } from "node:crypto";
import type { BaselineGraph, BaselineGraphItem, ImageBox, VisualPageLocation } from "./store";

export type GraphRegion = { page: number; regionId: string; rect: { x: number; y: number; width: number; height: number }; overview: { width: number; height: number }; display: { width: number; height: number } };
type Collection = "views" | "features" | "objectRelations" | "annotations" | "annotationRelations";
const collections: Collection[] = ["views", "features", "objectRelations", "annotations", "annotationRelations"];
const clean = (value: unknown, limit = 240) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const localKey = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48);

function box(value: unknown): ImageBox | undefined {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(item => typeof item === "number" && Number.isFinite(item))) return undefined;
  const [x, y, width, height] = value;
  return x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= 1000 && y + height <= 1000 ? { x, y, width, height } : undefined;
}

function pageLocation(region: GraphRegion, area: ImageBox): VisualPageLocation | undefined {
  if (!(region.overview.width > 0 && region.overview.height > 0 && region.display.width > 0 && region.display.height > 0)) return undefined;
  const scaleX = region.display.width / region.overview.width;
  const scaleY = region.display.height / region.overview.height;
  return { box: { x: (region.rect.x + area.x * region.rect.width / 1000) * scaleX, y: (region.rect.y + area.y * region.rect.height / 1000) * scaleY, width: area.width * region.rect.width * scaleX / 1000, height: area.height * region.rect.height * scaleY / 1000 }, pageWidth: region.display.width, pageHeight: region.display.height };
}

export function emptyGraph(): BaselineGraph { return { views: [], features: [], objectRelations: [], annotations: [], annotationRelations: [], reviewItems: [], coveredRegions: [], scope: "vision_regions" }; }

export function appendGraphRegion(graph: BaselineGraph, response: unknown, region: GraphRegion): BaselineGraph {
  if (!response || typeof response !== "object") throw new Error(`AI returned invalid object graph for ${region.regionId}`);
  const data = response as Record<string, unknown>;
  for (const name of collections) if (!Array.isArray(data[name]) || (data[name] as unknown[]).length > 100) throw new Error(`AI returned incomplete object graph for ${region.regionId}: ${name}`);
  const next: BaselineGraph = structuredClone(graph);
  const ids = new Map<string, string>();
  const parsed: Record<Collection, BaselineGraphItem[]> = { views: [], features: [], objectRelations: [], annotations: [], annotationRelations: [] };
  for (const name of collections) {
    for (const source of data[name] as unknown[]) {
      if (!source || typeof source !== "object") throw new Error(`AI returned invalid ${name} entry for ${region.regionId}`);
      const item = source as Record<string, unknown>;
      const localId = clean(item.id, 48);
      const label = clean(item.label);
      const type = clean(item.type, 80);
      if (!localId || !label || !type || ids.has(localId)) throw new Error(`AI returned invalid or duplicate ${name} ID for ${region.regionId}`);
      const area = box(item.bbox);
      const id = `${region.regionId}-${localKey(localId)}-${createHash("sha256").update(`${name}:${localId}`).digest("hex").slice(0, 6)}`;
      ids.set(localId, id);
      const confidence = typeof item.confidence === "number" && Number.isFinite(item.confidence) ? Math.min(0.8, Math.max(0, item.confidence)) : 0.4;
      parsed[name].push({ id, localId, page: region.page, regionId: region.regionId, ...(area ? { imageBox: area, visualPageLocation: pageLocation(region, area) } : {}), label, type, confidence, uncertainty: clean(item.uncertainty, 300) || undefined, rawText: clean(item.rawText, 300) || undefined, graphics: Array.isArray(item.graphics) ? item.graphics.map(value => clean(value, 80)).filter(Boolean).slice(0, 12) : undefined, relation: clean(item.relation, 100) || undefined, review: "pending" });
    }
  }
  const nodeIds = new Set([...parsed.views, ...parsed.features, ...parsed.annotations].map(item => item.id));
  const resolve = (value: unknown) => Array.isArray(value) ? value.map(key => ids.get(String(key))).filter((id): id is string => !!id && nodeIds.has(id)) : [];
  for (const name of collections) {
    for (const item of parsed[name]) {
      const source = (data[name] as Record<string, unknown>[]).find(value => value.id === item.localId)!;
      if (name === "features" || name === "annotations") {
        item.viewId = ids.get(String(source.viewId || ""));
        if (source.viewId && !parsed.views.some(value => value.id === item.viewId)) next.reviewItems.push({ id: `${item.id}-view`, targetId: item.id, reason: "Owning view could not be resolved within this region" });
      }
      if (name === "objectRelations" || name === "annotationRelations") {
        item.sourceIds = resolve(source.sourceIds);
        item.targetIds = resolve(source.targetIds);
        const validKinds = name === "objectRelations" ? new Set([...parsed.features, ...parsed.views].map(value => value.id)) : new Set(parsed.annotations.map(value => value.id));
        const targetKinds = name === "objectRelations" ? new Set([...parsed.features, ...parsed.views].map(value => value.id)) : new Set(parsed.features.map(value => value.id));
        if (!item.sourceIds.some(id => validKinds.has(id)) || !item.targetIds.some(id => targetKinds.has(id)) || item.sourceIds.length !== (Array.isArray(source.sourceIds) ? source.sourceIds.length : 0) || item.targetIds.length !== (Array.isArray(source.targetIds) ? source.targetIds.length : 0)) {
          next.reviewItems.push({ id: `${item.id}-link`, targetId: item.id, reason: "Relation endpoints are missing or not uniquely identified in this region" });
        }
      }
      if (item.confidence < 0.7 || item.uncertainty || !item.imageBox && name !== "objectRelations" && name !== "annotationRelations") next.reviewItems.push({ id: `${item.id}-uncertain`, targetId: item.id, reason: item.uncertainty || "Low confidence or missing location" });
      if (next[name].some(value => value.page === item.page && value.label.toLocaleLowerCase() === item.label.toLocaleLowerCase() && value.regionId !== item.regionId)) next.reviewItems.push({ id: `${item.id}-overlap`, targetId: item.id, reason: "Possible duplicate across adjacent PDF regions" });
      next[name].push(item);
    }
  }
  for (const item of parsed.annotations) {
    if (!parsed.annotationRelations.some(link => link.sourceIds?.includes(item.id) && link.targetIds?.length)) next.reviewItems.push({ id: `${item.id}-unlinked`, targetId: item.id, reason: "Annotation has no uniquely identified target feature" });
    if (!item.graphics?.length && !/note|title|label|注|标题|视图/i.test(item.type)) next.reviewItems.push({ id: `${item.id}-graphics`, targetId: item.id, reason: "Dimension arrows, extension lines or leader were not reconstructed" });
  }
  next.coveredRegions.push(region.regionId);
  return next;
}

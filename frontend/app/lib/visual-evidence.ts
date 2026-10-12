import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { jpegDimensions } from "./jpeg";
import { dataDir, type ImageBox } from "./store";

export type VisualSource = { drawingId: string; analysisRunId: string; imageSetId?: string; regionHashes?: Record<string, string> };
export class RegionIntegrityError extends Error {}

export async function readVisualRegion(source: VisualSource, regionId: string) {
  if (!/^p[1-9]\d*-r[1-9]\d*$/.test(regionId)) throw new Error("Invalid PDF region");
  if (source.imageSetId && !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(source.imageSetId)) throw new RegionIntegrityError("Invalid image set");
  const jpeg = await readFile(path.join(dataDir, "analysis", source.drawingId, source.analysisRunId, "vision", ...(source.imageSetId ? [source.imageSetId] : []), `${regionId}.jpg`));
  const expected = source.regionHashes?.[regionId];
  if (source.imageSetId && (!expected || !/^[\da-f]{64}$/i.test(expected))) throw new RegionIntegrityError("Submitted image hash is missing");
  if (expected && createHash("sha256").update(jpeg).digest("hex") !== expected) throw new RegionIntegrityError("PDF region differs from submitted AI image");
  return jpeg;
}

export async function visualEvidence(source: VisualSource, candidate: { regionId: string; imageBox: ImageBox }) {
  const { x, y, width, height } = candidate.imageBox;
  if (![x, y, width, height].every(Number.isFinite) || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1000 || y + height > 1000) throw new Error("Invalid visual location");
  const jpeg = await readVisualRegion(source, candidate.regionId);
  const size = jpegDimensions(jpeg);
  const box = { x: x * size.width / 1000, y: y * size.height / 1000, width: width * size.width / 1000, height: height * size.height / 1000 };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}" role="img" aria-label="Tentative AI location on original PDF crop"><desc>Orange box is the model suggested area, not a verified PDF geometry attachment.</desc><image href="data:image/jpeg;base64,${jpeg.toString("base64")}" x="0" y="0" width="${size.width}" height="${size.height}"/><rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="#f97316" fill-opacity="0.12" stroke="#e46e16" stroke-width="3"/></svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Content-Disposition": "inline", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; img-src data:" } });
}

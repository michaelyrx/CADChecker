import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { dataDir, type DrawingFact } from "./store";

const execute = promisify(execFile);
const clamp = (value: number, minimum: number, maximum: number) => Math.min(Math.max(value, minimum), maximum);

export async function factEvidence(source: { drawingId: string; analysisRunId: string; sourceSha256: string }, fact: DrawingFact) {
  if (!fact.textOrigin || !Number.isFinite(fact.textOrigin.x) || !Number.isFinite(fact.textOrigin.y)) throw new Error("Fact has no locatable PDF text");
  const filename = path.join(dataDir, "analysis", source.drawingId, source.analysisRunId, "vectors.json");
  const vectors = JSON.parse(await readFile(filename, "utf8"));
  if (vectors.source_sha256 !== source.sourceSha256 || !Array.isArray(vectors.pages)) throw new Error("Analysis evidence source is invalid");
  const page = vectors.pages.find((item: { page?: unknown }) => item.page === fact.page);
  const width = Number(page?.display_width);
  const height = Number(page?.display_height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || fact.textOrigin.x < 0 || fact.textOrigin.y < 0 || fact.textOrigin.x > width || fact.textOrigin.y > height) throw new Error("Fact position is outside the PDF page");
  const cropWidth = Math.min(width, 160);
  const cropHeight = Math.min(height, 120);
  const left = Math.floor(clamp(fact.textOrigin.x - cropWidth / 2, 0, width - cropWidth) * 2);
  const top = Math.floor(clamp(fact.textOrigin.y - cropHeight / 2, 0, height - cropHeight) * 2);
  const pixelWidth = Math.ceil(cropWidth * 2);
  const pixelHeight = Math.ceil(cropHeight * 2);
  const directory = await mkdtemp(path.join(os.tmpdir(), "cadlint-fact-evidence-"));
  try {
    const prefix = path.join(directory, "crop");
    const pdf = path.join(dataDir, "uploads", `${source.drawingId}.pdf`);
    await execute(process.env.CADLINT_PDFTOPPM || "pdftoppm", ["-f", String(fact.page), "-l", String(fact.page), "-r", "144", "-cropbox", "-x", String(left), "-y", String(top), "-W", String(pixelWidth), "-H", String(pixelHeight), "-jpeg", "-singlefile", pdf, prefix], { timeout: 45_000, maxBuffer: 1024 * 1024 });
    const jpeg = await readFile(`${prefix}.jpg`);
    const boxes = (fact.nearbyPaths || []).slice(0, 3).filter(item => [item.bbox.x, item.bbox.y, item.bbox.width, item.bbox.height].every(Number.isFinite)).map((item, index) => {
      const x = item.bbox.x * 2 - left;
      const y = item.bbox.y * 2 - top;
      const w = item.bbox.width * 2;
      const h = item.bbox.height * 2;
      const selected = fact.pathAssociation?.pathId === item.id;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${selected ? "#16834a" : "#e46e16"}" stroke-width="${selected ? 3 : 2}"/><text x="${clamp(x, 2, pixelWidth - 16)}" y="${clamp(y - 4, 14, pixelHeight - 3)}" font-size="12" font-weight="700" fill="${selected ? "#116638" : "#a43b08"}">${index + 1}</text>`;
    }).join("");
    const pointX = fact.textOrigin.x * 2 - left;
    const pointY = fact.textOrigin.y * 2 - top;
    const description = fact.pathAssociation ? "Green rectangle: path selected by a human, not a verified CAD feature or dimension attachment." : "No path has been selected.";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelWidth}" height="${pixelHeight}" viewBox="0 0 ${pixelWidth} ${pixelHeight}" role="img" aria-label="PDF text origin and nearby vector path boxes"><desc>Original PDF crop. Red dot: text origin. Orange numbered rectangles: nearby vector path candidates. ${description}</desc><image href="data:image/jpeg;base64,${jpeg.toString("base64")}" x="0" y="0" width="${pixelWidth}" height="${pixelHeight}"/><g>${boxes}</g><circle cx="${pointX}" cy="${pointY}" r="5" fill="#e52835" stroke="white" stroke-width="2"/></svg>`;
    return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Content-Disposition": "inline", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; img-src data:" } });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

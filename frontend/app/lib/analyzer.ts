import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { access, mkdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { dataDir, type Analysis, type Drawing, type EvidenceRegion, type PageInventory } from "./store";

const run = promisify(execFile);
const projectRoot = path.resolve(process.cwd(), "..");
const script = path.join(projectRoot, "nx-pdf-drawing-inspection", "scripts", "inspect_pdf.py");
const localPython = path.join(projectRoot, "backend", ".venv", "bin", "python");

async function pythonPath() {
  if (process.env.CADLINT_PYTHON) return process.env.CADLINT_PYTHON;
  try { await access(localPython); return localPython; } catch { return "python3"; }
}

export async function analyzeDrawing(drawing: Drawing): Promise<Analysis> {
  const startedAt = new Date().toISOString();
  const runId = randomUUID();
  const source = path.join(dataDir, "uploads", `${drawing.id}.pdf`);
  const directory = path.join(dataDir, "analysis", drawing.id, runId);
  const manifestPath = path.join(directory, "manifest.json");
  const vectorsPath = path.join(directory, "vectors.json");
  await mkdir(directory, { recursive: true });
  try {
    await run(await pythonPath(), [script, source, "--output", manifestPath, "--vectors", vectorsPath], { timeout: 60_000, maxBuffer: 1024 * 1024 });
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const vectors = JSON.parse(await readFile(vectorsPath, "utf8"));
    if (typeof manifest.sha256 !== "string" || !Array.isArray(vectors.pages) || manifest.page_count !== vectors.pages.length) throw new Error("Invalid parser output");
    const pages: PageInventory[] = vectors.pages.map((page: Record<string, unknown>) => {
      const pathConstruction = Number(page.path_construction_count) || 0;
      const pathPaint = Number(page.path_paint_count) || 0;
      const textOperations = Number(page.text_operation_count) || 0;
      const width = Number(page.display_width), height = Number(page.display_height);
      const validRegion = (value: unknown): value is EvidenceRegion => {
        if (!value || typeof value !== "object") return false;
        const region = value as EvidenceRegion;
        return [region.x, region.y, region.width, region.height].every(Number.isFinite) && region.x >= 0 && region.y >= 0 && region.width > 0 && region.height > 0 && region.x + region.width <= width + 0.01 && region.y + region.height <= height + 0.01;
      };
      const evidence = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 && Array.isArray(page.path_regions) && page.path_regions.length <= 200 && page.path_regions.every(validRegion)
        ? { width, height, rotation: Number(page.rotation) || 0, pathRegionCount: Number(page.path_region_count) || 0, pathRegions: page.path_regions as EvidenceRegion[] } : undefined;
      return { page: Number(page.page), pathConstruction, pathPaint, textOperations, xobjectDraws: Number(page.xobject_draw_count) || 0, status: pathPaint > 0 || textOperations > 0 ? "vector_content" : "undetermined", ...(evidence ? { evidence } : {}) };
    });
    return { status: "succeeded", startedAt, completedAt: new Date().toISOString(), runId, sha256: manifest.sha256, pageCount: manifest.page_count, pages, parser: "pdf-content-stream-v2" };
  } catch (error) {
    await Promise.all([unlink(manifestPath).catch(() => undefined), unlink(vectorsPath).catch(() => undefined)]);
    const message = String((error as Error).message);
    const reason = message.includes("No module named 'pypdf'") ? "Python dependency pypdf is missing" : message.includes("ETIMEDOUT") ? "PDF analysis timed out" : "PDF analysis failed";
    return { status: "failed", startedAt, completedAt: new Date().toISOString(), runId, error: reason, parser: "pdf-content-stream-v2" };
  }
}

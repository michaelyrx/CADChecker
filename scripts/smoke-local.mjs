import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blankPdf, vectorPdf } from "./pdf-fixtures.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const work = await mkdtemp(path.join(os.tmpdir(), "cadlint-smoke-"));
const dataDir = path.join(work, "data");
const python = path.join(root, "backend", ".venv", "bin", "python");
const nextCli = path.join(root, "frontend", "node_modules", "next", "dist", "bin", "next");
await access(python);
await access(nextCli);

const listener = net.createServer();
await new Promise((resolve, reject) => listener.once("error", reject).listen(0, "127.0.0.1", resolve));
const port = listener.address().port;
await new Promise(resolve => listener.close(resolve));
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [nextCli, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: path.join(root, "frontend"),
  env: { ...process.env, CADLINT_DATA_DIR: dataDir, CADLINT_PYTHON: python },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
server.stdout.on("data", chunk => { serverOutput += chunk.toString(); });
server.stderr.on("data", chunk => { serverOutput += chunk.toString(); });

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(`Server stopped: ${serverOutput}`);
    try { if ((await fetch(`${base}/api/categories`)).ok) return; } catch { /* still starting */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start: ${serverOutput}`);
}
async function json(url, options, expected = 200) {
  const response = await fetch(base + url, options);
  if (response.status !== expected) throw new Error(`${url}: HTTP ${response.status}, expected ${expected}: ${await response.text()}`);
  return response.json();
}
function uploadBody(bytes, name) {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "application/pdf" }), name);
  return form;
}

try {
  await waitForServer();
  assert.deepEqual(await json("/api/categories"), []);
  assert.deepEqual(await json("/api/projects"), []);
  const category = await json("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Verification category" }) }, 201);
  await json("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Missing category", categoryId: "unknown" }) }, 404);
  const project = await json("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Verification project", categoryId: category.id }) }, 201);
  const drawing = await json(`/api/projects/${project.id}/drawings`, { method: "POST", body: uploadBody(vectorPdf, "vector-line.pdf") }, 201);
  const analysis = await json(`/api/drawings/${drawing.id}/analysis`, { method: "POST" });
  assert.equal(analysis.status, "succeeded");
  assert.equal(analysis.pageCount, 1);
  assert.equal(analysis.pages[0].pathPaint, 1);
  assert.equal(analysis.pages[0].status, "vector_content");
  assert.equal((await json(`/api/drawings/${drawing.id}/analysis`)).runId, analysis.runId);
  assert.ok(Buffer.from(await (await fetch(`${base}/api/drawings/${drawing.id}/file`)).arrayBuffer()).equals(vectorPdf));
  await access(path.join(dataDir, "analysis", drawing.id, analysis.runId, "vectors.json"));
  const rerun = await json(`/api/drawings/${drawing.id}/analysis`, { method: "POST" });
  assert.notEqual(rerun.runId, analysis.runId);
  await access(path.join(dataDir, "analysis", drawing.id, analysis.runId, "vectors.json"));
  await access(path.join(dataDir, "analysis", drawing.id, rerun.runId, "vectors.json"));
  const blank = await json(`/api/projects/${project.id}/drawings`, { method: "POST", body: uploadBody(blankPdf, "blank-page.pdf") }, 201);
  const blankResult = await json(`/api/drawings/${blank.id}/analysis`, { method: "POST" });
  assert.equal(blankResult.pages[0].status, "undetermined");
  const broken = await json(`/api/projects/${project.id}/drawings`, { method: "POST", body: uploadBody(Buffer.from("%PDF-1.4\nbroken\n"), "broken.pdf") }, 201);
  assert.equal((await json(`/api/drawings/${broken.id}/analysis`, { method: "POST" })).status, "failed");
  const list = await json(`/api/projects/${project.id}/drawings`);
  assert.equal(list.length, 3);
  const inventory = JSON.parse(await readFile(path.join(dataDir, "analysis", drawing.id, rerun.runId, "vectors.json"), "utf8"));
  assert.equal(inventory.pages[0].path_paint_count, 1);
  console.log("Local smoke test passed: category, project, upload, preview, vector analysis, rerun, blank page, broken PDF.");
} finally {
  server.kill("SIGTERM");
  await new Promise(resolve => { if (server.exitCode !== null) resolve(); else server.once("exit", resolve); });
  await rm(work, { recursive: true, force: true });
}

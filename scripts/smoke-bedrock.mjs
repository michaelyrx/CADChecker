import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makePdf } from "./pdf-fixtures.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const work = await mkdtemp(path.join(os.tmpdir(), "cadlint-bedrock-"));
const python = path.join(root, "backend", ".venv", "bin", "python");
const nextCli = path.join(root, "frontend", "node_modules", "next", "dist", "bin", "next");
await access(python);
await access(nextCli);

async function freePort() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => listener.once("error", reject).listen(0, "127.0.0.1", resolve));
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  return port;
}

let sawImage = false;
let badObservation = true;
let shiftedBox = false;
const mock = createServer(async (request, response) => {
  try {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString());
  assert.match(request.url, /\/model\/.*\/converse$/);
  assert.equal(body.modelId, undefined);
  assert.equal(body.messages[0].role, "user");
  const payload = JSON.parse(body.messages[0].content[0].text);
  const image = body.messages[0].content.find(item => item.image);
  assert.ok(image);
  assert.equal(body.messages[0].content.filter(item => item.image).length, 6);
  assert.equal(image.image.format, "jpeg");
  assert.ok(Buffer.from(image.image.source.bytes, "base64").length > 0);
  sawImage = true;
  const regionId = payload.renderedRegions[0].regionId;
  const secondRegionId = payload.renderedRegions[1].regionId;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({ output: { message: { role: "assistant", content: [{ text: JSON.stringify({ facts: [{ page: 1, kind: "technical_note", quote: "BEDROCK MOCK NOTE", regionId, bbox: shiftedBox ? [400, 200, 300, 80] : [100, 200, 300, 80] }, { page: 1, kind: "technical_note", quote: "BEDROCK OTHER NOTE", regionId: secondRegionId }], observations: [{ page: 1, regionId: badObservation ? "unknown" : regionId, kind: "feature", description: "One visible diagonal line", bbox: [200, 100, 500, 700] }] }) }] } }, stopReason: "end_turn", usage: { inputTokens: 40, outputTokens: 20, totalTokens: 60 } }));
  } catch (error) { console.error(error); response.writeHead(500); response.end("mock failed"); }
});
await new Promise((resolve, reject) => mock.once("error", reject).listen(0, "127.0.0.1", resolve));
const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [nextCli, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: path.join(root, "frontend"),
  env: { ...process.env, CADLINT_DATA_DIR: path.join(work, "data"), CADLINT_PYTHON: python, CADLINT_AI_PROVIDER: "bedrock", AWS_REGION: "us-east-1", AWS_ACCESS_KEY_ID: "mock-access", AWS_SECRET_ACCESS_KEY: "mock-secret", AWS_EC2_METADATA_DISABLED: "true", BEDROCK_MODEL_ID: "mock.model", BEDROCK_ENDPOINT: `http://127.0.0.1:${mock.address().port}` },
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
server.stdout.on("data", chunk => { output += chunk.toString(); });
server.stderr.on("data", chunk => { output += chunk.toString(); });

async function json(url, options, expected = 200) {
  const response = await fetch(base + url, options);
  if (response.status !== expected) throw new Error(`${url}: ${response.status} ${await response.text()}`);
  return response.json();
}
const post = body => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

try {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(output);
    try { if ((await fetch(base + "/api/ai/status")).ok) break; } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const status = await json("/api/ai/status");
  assert.equal(status.provider, "bedrock");
  assert.equal(status.configured, true);
  assert.equal(status.model, "mock.model");
  const category = await json("/api/categories", post({ name: "Bedrock category" }), 201);
  const project = await json("/api/projects", post({ name: "Bedrock project", categoryId: category.id }), 201);
  const form = new FormData();
  form.append("file", new Blob([makePdf("25 25 m 975 675 l S\n", "[0 0 1000 700]")], { type: "application/pdf" }), "vector.pdf");
  const drawing = await json(`/api/projects/${project.id}/drawings`, { method: "POST", body: form }, 201);
  await json(`/api/drawings/${drawing.id}/analysis`, { method: "POST" });
  await json(`/api/projects/${project.id}/baselines`, post({ drawingId: drawing.id }), 502);
  badObservation = false;
  const baseline = await json(`/api/projects/${project.id}/baselines`, post({ drawingId: drawing.id }), 201);
  assert.equal(baseline.model, "mock.model");
  assert.equal(baseline.facts[0].quote, "BEDROCK MOCK NOTE");
  assert.equal(baseline.facts[0].sourceMethod, "vision");
  assert.ok(baseline.facts[0].visualPageLocation?.box.width > 0);
  assert.equal(baseline.facts[0].review, "pending");
  assert.equal(baseline.facts.length, 2);
  assert.equal(baseline.observations[0].kind, "feature");
  assert.deepEqual(baseline.observations[0].imageBox, { x: 200, y: 100, width: 500, height: 700 });
  assert.equal((await fetch(`${base}/api/baselines/${baseline.id}/regions/${baseline.observations[0].regionId}`)).status, 200);
  const baselineVisual = await fetch(`${base}/api/baselines/${baseline.id}/visual-evidence/${baseline.observations[0].id}`);
  assert.equal(baselineVisual.status, 200);
  assert.match(await baselineVisual.text(), /<rect x=/);
  await json(`/api/baselines/${baseline.id}/visual-evidence/${baseline.facts[1].id}`, undefined, 409);
  const patch = body => ({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  await json(`/api/baselines/${baseline.id}`, patch({ action: "approve" }), 409);
  await json(`/api/baselines/${baseline.id}`, patch({ action: "review", factId: baseline.facts[0].id, review: "confirmed" }));
  await json(`/api/baselines/${baseline.id}`, patch({ action: "approve" }), 409);
  await json(`/api/baselines/${baseline.id}`, patch({ action: "review", factId: baseline.facts[1].id, review: "confirmed" }));
  await json(`/api/baselines/${baseline.id}`, patch({ action: "review-observation", observationId: baseline.observations[0].id, review: "confirmed" }));
  assert.equal((await json(`/api/baselines/${baseline.id}`, patch({ action: "approve" }))).status, "approved");
  const targetForm = new FormData();
  targetForm.append("file", new Blob([makePdf("30 30 m 970 670 l S\n", "[0 0 1000 700]")], { type: "application/pdf" }), "target.pdf");
  const target = await json(`/api/projects/${project.id}/drawings`, { method: "POST", body: targetForm }, 201);
  await json(`/api/drawings/${target.id}/analysis`, { method: "POST" });
  const comparison = await json(`/api/projects/${project.id}/baseline-comparisons`, post({ baselineId: baseline.id, targetDrawingId: target.id }), 201);
  assert.equal(comparison.targetObservations[0].kind, "feature");
  assert.deepEqual(comparison.differences.map(item => item.status), ["matched", "ambiguous"]);
  assert.equal(comparison.differences[0].confidence, 0.4);
  shiftedBox = true;
  const shiftedComparison = await json(`/api/projects/${project.id}/baseline-comparisons`, post({ baselineId: baseline.id, targetDrawingId: target.id }), 201);
  assert.notEqual(shiftedComparison.imageSetId, comparison.imageSetId);
  assert.deepEqual(shiftedComparison.differences.map(item => item.status), ["position_changed", "ambiguous"]);
  assert.equal(comparison.differences[0].status, "matched");
  assert.equal((await fetch(`${base}/api/baseline-comparisons/${comparison.id}/visual-evidence/${comparison.targetObservations[0].id}`)).status, 200);
  assert.equal((await fetch(`${base}/api/baseline-comparisons/${comparison.id}/regions/${comparison.targetObservations[0].regionId}`)).status, 200);
  await writeFile(path.join(work, "data", "analysis", target.id, shiftedComparison.targetAnalysisRunId, "vision", shiftedComparison.imageSetId, "p1-r1.jpg"), "changed evidence");
  await json(`/api/baseline-comparisons/${shiftedComparison.id}/regions/p1-r1`, undefined, 409);
  await json(`/api/baseline-comparisons/${shiftedComparison.id}/visual-evidence/${shiftedComparison.targetObservations[0].id}`, undefined, 409);
  assert.equal((await fetch(`${base}/api/baseline-comparisons/${comparison.id}/regions/p1-r1`)).status, 200);
  assert.ok(sawImage);
  console.log("Bedrock mock smoke test passed: IAM signing, Converse vision, baseline evidence and review gate.");
} catch (error) {
  console.error(output);
  throw error;
} finally {
  server.kill("SIGTERM");
  mock.close();
  await rm(work, { recursive: true, force: true });
}

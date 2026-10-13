import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { requestDeepSeekJson } from "../app/lib/deepseek.ts";

const originalFetch = globalThis.fetch;
const originalKey = process.env.DEEPSEEK_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = originalKey;
});

test("structured DeepSeek requests disable thinking and accept complete JSON", async () => {
  process.env.DEEPSEEK_API_KEY = "test-key";
  let request;
  globalThis.fetch = async (_url, options) => {
    request = JSON.parse(options.body);
    return new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: '{"ok":true}' } }] }), { status: 200 });
  };

  const result = await requestDeepSeekJson("Return JSON", { sample: true }, 5000);
  assert.deepEqual(result.content, { ok: true });
  assert.deepEqual(request.thinking, { type: "disabled" });
  assert.equal(request.response_format.type, "json_object");
});

test("token-limit truncation is reported explicitly", async () => {
  process.env.DEEPSEEK_API_KEY = "test-key";
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ finish_reason: "length", message: { content: '{"facts":[' } }] }), { status: 200 });
  await assert.rejects(requestDeepSeekJson("Return JSON", {}, 5000), /output token limit/);
});

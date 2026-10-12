import { aiConfig, requestAiJson } from "@/app/lib/ai";
import { failure } from "@/app/lib/store";

export const runtime = "nodejs";

export async function POST() {
  const config = await aiConfig();
  if (!config.configured) return failure("Active AI provider is not configured", 503);
  try {
    const result = await requestAiJson(
      'Connection check. Return only the JSON object {"ok":true}.',
      { probe: "cadlint-connection-check-v1" },
      32,
      { provider: config.provider, model: config.model },
    );
    if ((result.content as { ok?: unknown } | null)?.ok !== true) throw new Error("AI provider returned an invalid connection check response");
    return Response.json({ ok: true, provider: config.provider, model: result.model, checkedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure((error as Error).message || "AI provider connection check failed", 502);
  }
}

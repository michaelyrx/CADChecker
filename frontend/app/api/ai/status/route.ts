import { aiStatus } from "@/app/lib/ai";
import { failure, updateDb, type AiProvider } from "@/app/lib/store";
export const runtime = "nodejs";

export async function GET() {
  return Response.json(await aiStatus(), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return failure("Invalid JSON"); }
  const provider = (body as { provider?: unknown } | null)?.provider;
  if (provider !== "deepseek" && provider !== "bedrock") return failure("Choose DeepSeek or Bedrock");
  await updateDb(db => { db.systemSettings = { aiProvider: provider as AiProvider, updatedAt: new Date().toISOString() }; });
  return Response.json(await aiStatus(), { headers: { "Cache-Control": "no-store" } });
}

import { aiConfig } from "@/app/lib/ai";
export const runtime = "nodejs";

export async function GET() {
  return Response.json(aiConfig(), { headers: { "Cache-Control": "no-store" } });
}

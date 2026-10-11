import { deepSeekConfig } from "@/app/lib/deepseek";
export const runtime = "nodejs";

export async function GET() {
  return Response.json(deepSeekConfig(), { headers: { "Cache-Control": "no-store" } });
}

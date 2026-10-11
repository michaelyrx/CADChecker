import { renderReportHtml } from "@/app/lib/reports";
import { failure, readDb } from "@/app/lib/store";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await readDb();
  const report = db.reports.find(item => item.id === id);
  if (!report) return failure("Report not found", 404);
  const locale = new URL(request.url).searchParams.get("lang") === "en" ? "en" : "zh-CN";
  return new Response(renderReportHtml(report, locale), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'" } });
}

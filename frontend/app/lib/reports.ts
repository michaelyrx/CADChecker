import { randomUUID } from "node:crypto";
import type { Database, ReportSnapshot, ReviewDecision } from "./store";

export function createReportSnapshot(db: Database, projectId: string, checkRunId: string): ReportSnapshot {
  const project = db.projects.find(item => item.id === projectId);
  if (!project) throw new Error("Project not found");
  const check = db.checkRuns.find(item => item.id === checkRunId && item.projectId === projectId);
  if (!check) throw new Error("Check run not found in project");
  const category = db.categories.find(item => item.id === check.categoryId);
  const drawing = db.drawings.find(item => item.id === check.drawingId);
  if (!category || !drawing) throw new Error("Report source is missing");
  const workflow = db.workflowRuns.find(item => item.checkRunId === check.id);
  const findings = check.results.map((result, resultIndex) => {
    const latest = [...db.findingReviews].reverse().find(item => item.checkRunId === check.id && item.resultIndex === resultIndex);
    return { ...structuredClone(result), review: latest ? { id: latest.id, decision: latest.decision, note: latest.note, reviewedAt: latest.reviewedAt } : null };
  });
  const decisions = findings.filter(item => item.status === "REVIEW").map(item => item.review?.decision || "pending");
  const count = (decision: ReviewDecision | "pending") => decisions.filter(item => item === decision).length;
  const summary = { pass: findings.filter(item => item.status === "PASS").length, review: decisions.length, confirmed: count("confirmed"), dismissed: count("dismissed"), followUp: count("follow_up"), pending: count("pending") };
  return {
    id: randomUUID(), projectId, projectName: project.name, categoryId: category.id, categoryName: category.name,
    drawingId: drawing.id, drawingName: drawing.name, checkRunId: check.id, checkCreatedAt: check.createdAt,
    ruleVersion: check.releaseVersion, ruleSha256: check.releaseSha256, analysisRunId: check.analysisRunId, sourceSha256: check.sourceSha256,
    ...(workflow ? { workflowRunId: workflow.id, workflowVersion: workflow.workflowVersion, workflowSha256: workflow.workflowSha256, ...(workflow.review ? { workflowReview: structuredClone(workflow.review) } : {}) } : {}),
    createdAt: new Date().toISOString(), scope: "pdf_input_quality_v1", status: summary.pending || summary.followUp ? "pending_review" : "complete", summary, findings,
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export function renderReportHtml(report: ReportSnapshot, locale: "zh-CN" | "en"): string {
  const en = locale === "en";
  const label = (zh: string, english: string) => en ? english : zh;
  const status = (decision: ReviewDecision | null) => decision === "confirmed" ? label("确认存在输入质量问题", "Input quality concern confirmed") : decision === "dismissed" ? label("无需处理", "No action needed") : decision === "follow_up" ? label("需跟进", "Follow-up needed") : label("待复核", "Pending review");
  const rows = report.findings.map(item => `<tr><td>${escapeHtml(item.ruleCode)}</td><td>${escapeHtml(item.ruleName)}</td><td>${item.page ?? "—"}</td><td>${item.observed}</td><td>${item.threshold}</td><td>${item.status === "PASS" ? label("通过", "Pass") : label("待人工确认", "Review")}</td><td>${item.status === "PASS" ? "—" : escapeHtml(status(item.review?.decision || null))}</td><td>${escapeHtml(item.review?.note || "")}</td></tr>`).join("");
  const workflowReview = report.workflowReview ? `<h2>${label("流程级复核", "Workflow-level review")}</h2><p>${report.workflowReview.decision === "accepted" ? label("确认完成", "Accepted") : label("需处理", "Needs action")} · ${escapeHtml(report.workflowReview.reviewedAt)} · ${escapeHtml(report.workflowReview.note)}</p>` : "";
  return `<!doctype html><html lang="${en ? "en" : "zh-CN"}"><head><meta charset="utf-8"><title>CADLint · ${label("PDF 输入质量报告", "PDF input quality report")}</title><style>body{font:14px/1.6 system-ui,-apple-system,"PingFang SC",sans-serif;color:#172b4d;max-width:1100px;margin:40px auto;padding:0 28px}h1{font-size:28px;margin:0 0 8px}h2{font-size:17px;margin:30px 0 8px}.muted{color:#60758d}.notice{padding:14px 16px;background:#eff5fc;border-left:4px solid #1655a5;margin:24px 0}.summary{display:flex;gap:24px;flex-wrap:wrap}.summary strong{font-size:22px;display:block}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #dce5ee;padding:8px;text-align:left;vertical-align:top}th{background:#f4f7fb}dl{display:grid;grid-template-columns:180px 1fr;gap:6px 12px;overflow-wrap:anywhere}dt{color:#60758d}dd{margin:0}@media print{body{margin:0;max-width:none;padding:0}thead{display:table-header-group}tr{break-inside:avoid}}</style></head><body><h1>CADLint · ${label("PDF 输入质量报告", "PDF input quality report")}</h1><div class="muted">${label("生成时间", "Generated")}: ${escapeHtml(report.createdAt)} · ${label("快照", "Snapshot")}: ${escapeHtml(report.id)}</div><div class="notice">${label("本报告仅记录矢量 PDF 内容流的输入质量统计与人工复核，不代表 CAD 几何、尺寸或标注已通过检查。", "This report covers vector PDF content-stream input quality and human review only. It does not certify CAD geometry, dimensions, or annotations.")}</div><div class="summary"><div>${label("通过", "Pass")}<strong>${report.summary.pass}</strong></div><div>${label("待确认结果", "Review results")}<strong>${report.summary.review}</strong></div><div>${label("确认问题", "Confirmed concerns")}<strong>${report.summary.confirmed}</strong></div><div>${label("仍需复核或跟进", "Pending or follow-up")}<strong>${report.summary.pending + report.summary.followUp}</strong></div></div><h2>${label("来源与版本", "Source and versions")}</h2><dl><dt>${label("项目", "Project")}</dt><dd>${escapeHtml(report.projectName)}</dd><dt>${label("产品类别", "Category")}</dt><dd>${escapeHtml(report.categoryName)}</dd><dt>${label("图纸", "Drawing")}</dt><dd>${escapeHtml(report.drawingName)}</dd><dt>${label("规则版本", "Rules version")}</dt><dd>v${report.ruleVersion} · ${escapeHtml(report.ruleSha256)}</dd>${report.workflowVersion ? `<dt>${label("流程版本", "Workflow version")}</dt><dd>v${report.workflowVersion} · ${escapeHtml(report.workflowSha256)}</dd>` : ""}<dt>${label("检查记录", "Check run")}</dt><dd>${escapeHtml(report.checkRunId)}</dd><dt>${label("分析记录", "Analysis run")}</dt><dd>${escapeHtml(report.analysisRunId)}</dd><dt>PDF SHA-256</dt><dd>${escapeHtml(report.sourceSha256)}</dd></dl>${workflowReview}<h2>${label("逐项结果", "Results")}</h2><table><thead><tr><th>${label("规则编号", "Rule code")}</th><th>${label("规则名称", "Rule name")}</th><th>${label("页码", "Page")}</th><th>${label("实际值", "Observed")}</th><th>${label("阈值", "Threshold")}</th><th>${label("规则结果", "Rule result")}</th><th>${label("人工判断", "Human decision")}</th><th>${label("备注", "Note")}</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

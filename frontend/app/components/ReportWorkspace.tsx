"use client";
import { useEffect, useState } from "react";
import { useLocale } from "../lib/locale";

type Check = { id: string; drawingId: string; releaseVersion: number; createdAt: string; results: { status: "PASS" | "REVIEW" }[] };
type Report = { id: string; drawingName: string; checkRunId: string; createdAt: string; status: "pending_review" | "complete"; ruleVersion: number; ruleSha256: string; workflowVersion?: number; workflowSha256?: string; workflowReview?: { decision: "accepted" | "needs_action"; note: string; reviewedAt: string }; sourceSha256: string; summary: { pass: number; review: number; confirmed: number; dismissed: number; followUp: number; pending: number }; findings: { ruleCode: string; ruleName: string; page?: number; observed: number; threshold: number; status: "PASS" | "REVIEW"; review: { decision: "confirmed" | "dismissed" | "follow_up"; note: string } | null }[] };
type Drawing = { id: string; name: string };
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data as T;
}

export default function ReportWorkspace({ projectId, drawings, selectedDrawingId }: { projectId: string; drawings: Drawing[]; selectedDrawingId: string }) {
  const { locale, t } = useLocale();
  const [checks, setChecks] = useState<Check[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [checkRunId, setCheckRunId] = useState("");
  const [reportId, setReportId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = reports.find(item => item.id === reportId) || reports[0];
  const htmlUrl = selected ? `/api/reports/${selected.id}/html?lang=${locale === "en" ? "en" : "zh-CN"}` : "";
  const decisionText = (decision?: Report["findings"][number]["review"]) => decision?.decision === "confirmed" ? t("确认输入质量问题", "Concern confirmed") : decision?.decision === "dismissed" ? t("无需处理", "No action needed") : decision?.decision === "follow_up" ? t("需跟进", "Follow-up needed") : t("待复核", "Pending review");

  useEffect(() => {
    let live = true;
    Promise.all([api<Check[]>(`/api/projects/${projectId}/checks`), api<Report[]>(`/api/projects/${projectId}/reports`)]).then(([items, snapshots]) => { if (live) { setChecks(items); setReports(snapshots); setCheckRunId(items.find(item => item.drawingId === selectedDrawingId)?.id || items[0]?.id || ""); setReportId(snapshots[0]?.id || ""); setError(""); } }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [projectId, selectedDrawingId]);

  async function createReport() {
    if (!checkRunId) return;
    setBusy(true); setError("");
    try { const item = await api<Report>(`/api/projects/${projectId}/reports`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkRunId }) }); setReports(current => [item, ...current]); setReportId(item.id); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return <div className="dl-reports"><section className="dl-card"><div className="dl-card-heading"><h2>{t("生成报告快照", "Create report snapshot")}</h2></div><div className="dl-report-create"><select aria-label={t("检查记录", "Check run")} value={checkRunId} onChange={e => setCheckRunId(e.target.value)}><option value="">{t("选择检查记录", "Choose a check run")}</option>{checks.map(item => <option key={item.id} value={item.id}>{drawings.find(d => d.id === item.drawingId)?.name || item.drawingId} · v{item.releaseVersion} · {new Date(item.createdAt).toLocaleString(locale)}</option>)}</select><button className="dl-primary" disabled={busy || !checkRunId} onClick={createReport}>{t("生成新快照", "Create snapshot")}</button></div><p className="dl-rules-hint dl-workflow-note">{t("快照保存当前检查结果和逐项人工判断；后续复核不会修改已生成的报告。报告仅针对 PDF 输入质量。", "A snapshot freezes the check and current item decisions. Later decisions do not change existing reports. Scope: PDF input quality only.")}</p>{error && <p className="dl-error dl-workflow-note" role="alert">{error}</p>}</section><div className="dl-check-grid"><section className="dl-card"><div className="dl-card-heading"><h2>{t("历史报告", "Report history")}</h2><span>{reports.length}</span></div><div className="dl-check-list">{reports.length ? reports.map(item => <button key={item.id} className={`dl-check-item ${selected?.id === item.id ? "selected" : ""}`} onClick={() => setReportId(item.id)}><strong>{item.drawingName}</strong><span>{new Date(item.createdAt).toLocaleString(locale)} · {t("规则", "Rules")} v{item.ruleVersion}</span><small>{item.status === "complete" ? t("判断已完成", "Decisions complete") : t("仍有待复核或跟进项", "Review or follow-up pending")}</small></button>) : <p className="dl-card-empty">{t("尚无报告快照", "No report snapshots yet")}</p>}</div></section><section className="dl-card"><div className="dl-card-heading"><h2>{t("报告预览", "Report preview")}</h2>{selected && <span>{selected.id.slice(0, 8)}</span>}</div>{selected ? <div className="dl-report-preview"><h3>{selected.drawingName}</h3><p>{t("检查范围：矢量 PDF 输入质量", "Scope: vector PDF input quality")}</p><div className="dl-report-summary"><span>{t("通过", "Pass")} <strong>{selected.summary.pass}</strong></span><span>{t("待确认结果", "Review results")} <strong>{selected.summary.review}</strong></span><span>{t("确认问题", "Confirmed concerns")} <strong>{selected.summary.confirmed}</strong></span><span>{t("待复核或跟进", "Pending or follow-up")} <strong>{selected.summary.pending + selected.summary.followUp}</strong></span></div><p>{t("规则版本", "Rules version")}: v{selected.ruleVersion}{selected.workflowVersion ? ` · ${t("流程版本", "Workflow version")}: v${selected.workflowVersion}` : ""}</p>{selected.workflowReview && <p>{t("流程级复核", "Workflow-level review")}: {selected.workflowReview.decision === "accepted" ? t("确认完成", "Accepted") : t("需处理", "Needs action")}{selected.workflowReview.note ? ` · ${selected.workflowReview.note}` : ""}</p>}<div className="dl-report-findings">{selected.findings.map((item, index) => <div key={`${item.ruleCode}-${index}`}><strong>{item.ruleCode} · {item.ruleName}</strong><span>{item.page ? `${t("第", "Page ")}${item.page}${locale === "en" ? "" : " 页"} · ` : ""}{item.observed} / {item.threshold}</span><em>{item.status === "PASS" ? t("通过", "Pass") : decisionText(item.review)}</em></div>)}</div><div className="dl-report-actions"><a className="dl-secondary" href={htmlUrl} target="_blank" rel="noopener noreferrer">{t("打开可打印报告", "Open printable report")}</a><a className="dl-primary" href={htmlUrl} download={`CADLint-report-${selected.id}.html`}>{t("下载 HTML", "Download HTML")}</a></div><p className="dl-check-trace">{t("规则摘要", "Rule hash")}: {selected.ruleSha256.slice(0, 16)}… · PDF SHA-256: {selected.sourceSha256.slice(0, 16)}…</p></div> : <p className="dl-card-empty">{t("选择检查记录生成报告。", "Choose a check run to create a report.")}</p>}</section></div></div>;
}

"use client";
import { useEffect, useState } from "react";
import { useLocale } from "../lib/locale";

type Config = { analysisMode: "reuse" | "fresh"; reviewMode: "on_review" | "always" | "off" };
type Draft = { config: Config; baseVersion: number };
type Release = { id: string; version: number; config: Config; sha256: string; publishedAt: string };
type View = { draft: Draft | null; latest: Release | null; releases: Release[] };
type Step = { key: "analyze" | "check" | "review"; status: "pending" | "running" | "succeeded" | "skipped" | "failed" | "waiting"; detail?: string };
type Run = { id: string; drawingId: string; checkRunId?: string; workflowVersion: number; ruleVersion: number; workflowSha256: string; ruleSha256: string; sourceSha256?: string; status: "running" | "awaiting_review" | "completed" | "failed"; createdAt: string; steps: Step[]; review?: { decision: "accepted" | "needs_action"; note: string } };
type Check = { id: string; results: { ruleCode: string; ruleName: string; page?: number; observed: number; threshold: number; status: "PASS" | "REVIEW" }[] };
type Drawing = { id: string; name: string };
const initial: Config = { analysisMode: "reuse", reviewMode: "on_review" };
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result as T;
}

export default function WorkflowWorkspace({ projectId, categoryId, drawings, selectedDrawingId, onSelectDrawing, onDrawingUpdated }: { projectId: string; categoryId: string; drawings: Drawing[]; selectedDrawingId: string; onSelectDrawing: (id: string) => void; onDrawingUpdated: () => void }) {
  const { locale, t } = useLocale();
  const [view, setView] = useState<View>({ draft: null, latest: null, releases: [] });
  const [config, setConfig] = useState<Config>(initial);
  const [dirty, setDirty] = useState(false);
  const [runs, setRuns] = useState<Run[]>([]);
  const [checks, setChecks] = useState<Check[]>([]);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [rulesVersion, setRulesVersion] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedRun = runs.find(item => item.id === selectedRunId) || runs[0];
  const selectedCheck = checks.find(item => item.id === selectedRun?.checkRunId);
  const workflowUrl = `/api/projects/${projectId}/workflow`;
  const runUrl = `/api/projects/${projectId}/workflow-runs`;
  const errors: Record<string, string> = { "Save a workflow draft before publishing": "请先保存流程草稿", "Workflow is unchanged": "流程配置未改变", "No released rules for this category": "请先在产品类别中发布规则", "No released workflow for this project": "请先发布流程版本", "Drawing is already running": "该图纸正在执行中", "Workflow is not awaiting review": "该任务当前无需复核" };
  const message = locale === "en" ? error : errors[error] || error;
  const stepName = (key: Step["key"]) => key === "analyze" ? t("PDF 矢量分析", "PDF vector analysis") : key === "check" ? t("输入质量检查", "Input quality check") : t("人工复核", "Human review");
  const statusName = (status: Step["status"] | Run["status"]) => ({ pending: t("等待", "Pending"), running: t("运行中", "Running"), succeeded: t("完成", "Done"), skipped: t("跳过", "Skipped"), failed: t("失败", "Failed"), waiting: t("待复核", "Awaiting review"), awaiting_review: t("待复核", "Awaiting review"), completed: t("已完成", "Completed") })[status];

  useEffect(() => {
    let live = true;
    Promise.all([api<View>(workflowUrl), api<Run[]>(runUrl), api<{ latest: { version: number } | null }>(`/api/categories/${categoryId}/rules`), api<Check[]>(`/api/projects/${projectId}/checks`)]).then(([data, items, rules, checkItems]) => {
      if (!live) return;
      setView(data); setConfig(data.draft?.config || data.latest?.config || initial); setDirty(false);
      setRuns(items); setSelectedRunId(items[0]?.id || ""); setChecks(checkItems); setRulesVersion(rules.latest?.version || null); setError("");
    }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [projectId, categoryId, workflowUrl, runUrl]);

  async function saveDraft() {
    setBusy(true); setError("");
    try { const draft = await api<Draft>(workflowUrl, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config }) }); setView(current => ({ ...current, draft })); setDirty(false); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function publish() {
    setBusy(true); setError("");
    try { await api<Release>(`${workflowUrl}/publish`, { method: "POST" }); const data = await api<View>(workflowUrl); setView(data); setConfig(data.latest?.config || initial); setDirty(false); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function runWorkflow() {
    if (!selectedDrawingId) return;
    setBusy(true); setError("");
    try { const run = await api<Run>(runUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ drawingId: selectedDrawingId }) }); setRuns(current => [run, ...current]); setSelectedRunId(run.id); setChecks(await api<Check[]>(`/api/projects/${projectId}/checks`)); onDrawingUpdated(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function review(decision: "accepted" | "needs_action") {
    if (!selectedRun) return;
    setBusy(true); setError("");
    try { const run = await api<Run>(`/api/workflow-runs/${selectedRun.id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, note }) }); setRuns(current => current.map(item => item.id === run.id ? run : item)); setNote(""); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return <div className="dl-workflow">
    <section className="dl-card"><div className="dl-card-heading"><h2>{t("流程配置", "Workflow configuration")}</h2><span>{view.latest ? `${t("已发布", "Released")} v${view.latest.version}` : t("尚未发布", "Not released")}</span></div>
      <div className="dl-workflow-nodes">
        <div className="dl-workflow-node"><span>01</span><div><strong>{stepName("analyze")}</strong><p>{t("读取 PDF 页面和内容流", "Read PDF pages and content streams")}</p><label>{t("执行方式", "Execution mode")} <select value={config.analysisMode} onChange={e => { setConfig({ ...config, analysisMode: e.target.value as Config["analysisMode"] }); setDirty(true); }}><option value="reuse">{t("已有结果时复用", "Reuse existing analysis")}</option><option value="fresh">{t("每次重新分析", "Analyze on every run")}</option></select></label></div></div>
        <div className="dl-workflow-arrow">↓</div>
        <div className="dl-workflow-node"><span>02</span><div><strong>{stepName("check")}</strong><p>{t("锁定该类别最新发布的规则版本并执行", "Freeze and run the category's latest released rules")}</p></div></div>
        <div className="dl-workflow-arrow">↓</div>
        <div className="dl-workflow-node"><span>03</span><div><strong>{stepName("review")}</strong><p>{t("记录人工判断，不改变原始检查结果", "Record a human decision without changing check results")}</p><label>{t("复核条件", "Review trigger")} <select value={config.reviewMode} onChange={e => { setConfig({ ...config, reviewMode: e.target.value as Config["reviewMode"] }); setDirty(true); }}><option value="on_review">{t("有待确认项时", "When a result needs review")}</option><option value="always">{t("每次都复核", "Every run")}</option><option value="off">{t("跳过人工复核", "Skip human review")}</option></select></label></div></div>
      </div>
      <div className="dl-workflow-actions"><button className="dl-secondary" disabled={busy || (!dirty && !!(view.draft || view.latest))} onClick={saveDraft}>{t("保存草稿", "Save draft")}</button><button className="dl-primary" disabled={busy || dirty || !view.draft} onClick={publish}>{t("发布新版本", "Publish new version")}</button></div>
      {view.releases.length > 0 && <div className="dl-rule-history"><strong>{t("发布历史", "Release history")}</strong>{view.releases.map(item => <p key={item.id}>v{item.version} · {new Date(item.publishedAt).toLocaleString(locale)} · {item.sha256.slice(0, 12)}</p>)}</div>}
    </section>
    <section className="dl-card"><div className="dl-card-heading"><h2>{t("运行流程", "Run workflow")}</h2><span>{rulesVersion ? `${t("规则", "Rules")} v${rulesVersion}` : t("尚无已发布规则", "No released rules")}</span></div><div className="dl-check-controls"><select aria-label={t("待检图纸", "Drawing to check")} value={selectedDrawingId} onChange={e => onSelectDrawing(e.target.value)}><option value="">{t("选择图纸", "Choose drawing")}</option>{drawings.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="dl-primary" disabled={busy || !selectedDrawingId || !view.latest || !rulesVersion} onClick={runWorkflow}>{busy ? t("处理中…", "Working…") : t("运行已发布流程", "Run released workflow")}</button></div><p className="dl-rules-hint dl-workflow-note">{t("流程运行会执行分析和输入质量检查；任务记录固定流程、规则和 PDF 版本。", "A run performs analysis and input quality checks, freezing workflow, rules, and PDF versions.")}</p>{error && <p className="dl-error dl-workflow-note" role="alert">{message}</p>}</section>
    <div className="dl-check-grid"><section className="dl-card"><div className="dl-card-heading"><h2>{t("执行记录", "Run history")}</h2><span>{runs.length}</span></div><div className="dl-check-list">{runs.length ? runs.map(item => <button key={item.id} className={`dl-check-item ${selectedRun?.id === item.id ? "selected" : ""}`} onClick={() => { setSelectedRunId(item.id); setNote(""); }}><strong>{drawings.find(d => d.id === item.drawingId)?.name || item.drawingId}</strong><span>{t("流程", "Flow")} v{item.workflowVersion} · {t("规则", "Rules")} v{item.ruleVersion}</span><small>{statusName(item.status)} · {new Date(item.createdAt).toLocaleString(locale)}</small></button>) : <p className="dl-card-empty">{t("尚无执行记录", "No runs yet")}</p>}</div></section><section className="dl-card"><div className="dl-card-heading"><h2>{t("执行详情", "Run details")}</h2></div>{selectedRun ? <><div className="dl-check-meta">{statusName(selectedRun.status)} · {t("流程", "Flow")} v{selectedRun.workflowVersion} · {t("规则", "Rules")} v{selectedRun.ruleVersion}</div><div className="dl-workflow-step-list">{selectedRun.steps.map(item => <div key={item.key} className="dl-workflow-step"><strong>{stepName(item.key)}</strong><span>{statusName(item.status)}</span>{item.detail && <small>{item.detail}</small>}</div>)}</div>{selectedCheck && <div className="dl-workflow-findings"><strong>{t("输入质量结果", "Input quality results")}</strong>{selectedCheck.results.map((result, index) => <div className="dl-check-result" key={`${result.ruleCode}-${result.page || 0}-${index}`}><strong>{result.ruleCode} · {result.ruleName}</strong><span>{result.page ? `${t("第", "Page ")}${result.page}${locale === "en" ? "" : " 页"} · ` : ""}{t("实际", "Observed")}: {result.observed} / {t("阈值", "Threshold")}: {result.threshold}</span><em className={result.status === "PASS" ? "pass" : "review"}>{result.status === "PASS" ? t("通过", "Pass") : t("待人工确认", "Review")}</em></div>)}</div>}{selectedRun.status === "awaiting_review" && <div className="dl-workflow-review"><label>{t("复核备注", "Review note")}<textarea maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder={t("记录判断依据（选填）", "Record the reason (optional)")}/></label><div><button className="dl-secondary" disabled={busy} onClick={() => review("needs_action")}>{t("需处理", "Needs action")}</button><button className="dl-primary" disabled={busy} onClick={() => review("accepted")}>{t("确认完成", "Accept")}</button></div></div>}{selectedRun.review && <p className="dl-workflow-review-result">{t("复核结论", "Review decision")}: {selectedRun.review.decision === "accepted" ? t("确认完成", "Accepted") : t("需处理", "Needs action")}{selectedRun.review.note ? ` · ${selectedRun.review.note}` : ""}</p>}<p className="dl-check-trace">{t("流程摘要", "Workflow hash")}: {selectedRun.workflowSha256.slice(0, 12)}… · {t("规则摘要", "Rule hash")}: {selectedRun.ruleSha256.slice(0, 12)}…{selectedRun.sourceSha256 ? ` · PDF SHA-256: ${selectedRun.sourceSha256.slice(0, 12)}…` : ""}</p></> : <p className="dl-card-empty">{t("选择执行记录查看详情。", "Select a run to view details.")}</p>}</section></div>
  </div>;
}

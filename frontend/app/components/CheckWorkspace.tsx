"use client";
import { useEffect, useState } from "react";
import { useLocale } from "../lib/locale";

type Drawing = { id: string; name: string; analysis?: { status: string } };
type Result = { ruleCode: string; ruleName: string; page?: number; observed: number; threshold: number; status: "PASS" | "REVIEW" };
type Run = { id: string; drawingId: string; releaseVersion: number; releaseSha256: string; sourceSha256: string; analysisRunId: string; createdAt: string; results: Result[] };
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result as T;
}

export default function CheckWorkspace({ projectId, categoryId, drawings, selectedDrawingId, onSelectDrawing }: { projectId: string; categoryId: string; drawings: Drawing[]; selectedDrawingId: string; onSelectDrawing: (id: string) => void }) {
  const { locale, t } = useLocale();
  const [runs, setRuns] = useState<Run[]>([]);
  const [latestVersion, setLatestVersion] = useState<number | null>(null);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const drawing = drawings.find(d => d.id === selectedDrawingId);
  const selectedRun = runs.find(r => r.id === selectedRunId) || runs[0];
  useEffect(() => {
    let live = true;
    api<Run[]>(`/api/projects/${projectId}/checks`).then(items => { if (live) { setRuns(items); setSelectedRunId(items[0]?.id || ""); } }).catch(e => { if (live) setError(e.message); });
    api<{ latest: { version: number } | null }>(`/api/categories/${categoryId}/rules`).then(data => { if (live) setLatestVersion(data.latest?.version || null); }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [projectId, categoryId]);
  async function runCheck() {
    if (!drawing) return;
    setBusy(true); setError("");
    try { const run = await api<Run>(`/api/drawings/${drawing.id}/checks`, { method: "POST" }); setRuns(current => [run, ...current]); setSelectedRunId(run.id); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <div className="dl-checks"><div className="dl-card dl-check-create"><div className="dl-card-heading"><h2>{t("发起输入质量检查", "Run input quality check")}</h2><span>{latestVersion ? `${t("规则版本", "Rules version")} v${latestVersion}` : t("尚无已发布规则", "No released rules")}</span></div><div className="dl-check-controls"><select aria-label={t("待检图纸", "Drawing to check")} value={selectedDrawingId} onChange={e => onSelectDrawing(e.target.value)}><option value="">{t("选择图纸", "Choose drawing")}</option>{drawings.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="dl-primary" disabled={busy || !latestVersion || drawing?.analysis?.status !== "succeeded"} onClick={runCheck}>{busy ? t("检查中…", "Checking…") : t("运行检查", "Run check")}</button></div><p className="dl-rules-hint">{t("请先在图纸页完成矢量内容分析，并在产品类别中发布规则。结果只针对 PDF 输入质量。", "Analyze the drawing first and publish category rules. Results cover PDF input quality only.")}</p>{error && <p className="dl-error" role="alert">{locale === "en" ? error : ({ "Drawing analysis is required": "请先分析图纸", "No released rules for this category": "该类别暂无已发布规则" } as Record<string,string>)[error] || error}</p>}</div>
    <div className="dl-check-grid"><section className="dl-card"><div className="dl-card-heading"><h2>{t("检查记录", "Check history")}</h2><span>{runs.length}</span></div><div className="dl-check-list">{runs.length ? runs.map(run => <button key={run.id} className={`dl-check-item ${selectedRun?.id === run.id ? "selected" : ""}`} onClick={() => setSelectedRunId(run.id)}><strong>{drawings.find(d => d.id === run.drawingId)?.name || run.drawingId}</strong><span>v{run.releaseVersion} · {new Date(run.createdAt).toLocaleString(locale)}</span><small>{run.results.filter(result => result.status === "REVIEW").length} {t("项待确认", "need review")}</small></button>) : <p className="dl-card-empty">{t("尚无检查记录", "No checks yet")}</p>}</div></section><section className="dl-card"><div className="dl-card-heading"><h2>{t("检查结果", "Check results")}</h2></div>{selectedRun ? <><div className="dl-check-meta">{t("规则版本", "Rules version")}: v{selectedRun.releaseVersion} · {t("通过", "Pass")}: {selectedRun.results.filter(r => r.status === "PASS").length} · {t("待确认", "Review")}: {selectedRun.results.filter(r => r.status === "REVIEW").length}</div><div className="dl-check-results">{selectedRun.results.map((result, index) => <div key={`${result.ruleCode}-${result.page || 0}-${index}`} className="dl-check-result"><strong>{result.ruleCode} · {result.ruleName}</strong><span>{result.page ? `${t("第", "Page ")}${result.page}${locale === "en" ? "" : " 页"} · ` : ""}{t("实际", "Observed")}: {result.observed} / {t("阈值", "Threshold")}: {result.threshold}</span><em className={result.status === "PASS" ? "pass" : "review"}>{result.status === "PASS" ? t("通过", "Pass") : t("待人工确认", "Review")}</em></div>)}</div><p className="dl-check-trace">{t("规则摘要", "Rule hash")}: {selectedRun.releaseSha256.slice(0, 16)}… · PDF SHA-256: {selectedRun.sourceSha256.slice(0, 16)}…</p></> : <p className="dl-card-empty">{t("选择检查记录查看结果。", "Select a check to view results.")}</p>}</section></div>
  </div>;
}

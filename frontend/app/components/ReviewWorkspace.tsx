"use client";
import { useEffect, useState } from "react";
import { useLocale } from "../lib/locale";

type Result = { ruleCode: string; ruleName: string; page?: number; observed: number; threshold: number; status: "PASS" | "REVIEW" };
type Check = { id: string; drawingId: string; releaseVersion: number; releaseSha256: string; sourceSha256: string; createdAt: string; results: Result[] };
type Review = { id: string; checkRunId: string; resultIndex: number; decision: "confirmed" | "dismissed" | "follow_up"; note: string; reviewedAt: string };
type Drawing = { id: string; name: string };
type Finding = { key: string; check: Check; index: number; result: Result; latest?: Review };
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data as T;
}

export default function ReviewWorkspace({ projectId, drawings, onSelectDrawing }: { projectId: string; drawings: Drawing[]; onSelectDrawing: (id: string) => void }) {
  const { locale, t } = useLocale();
  const [checks, setChecks] = useState<Check[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "resolved">("all");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const findings: Finding[] = checks.flatMap(check => check.results.flatMap((result, index) => result.status === "REVIEW" ? [{ key: `${check.id}:${index}`, check, index, result, latest: [...reviews].reverse().find(item => item.checkRunId === check.id && item.resultIndex === index) }] : []));
  const visible = findings.filter(item => filter === "all" || (filter === "pending" ? !item.latest || item.latest.decision === "follow_up" : !!item.latest && item.latest.decision !== "follow_up"));
  const selected = findings.find(item => item.key === selectedKey) || visible[0];
  const history = selected ? reviews.filter(item => item.checkRunId === selected.check.id && item.resultIndex === selected.index).slice().reverse() : [];
  const decisionText = (decision?: Review["decision"]) => decision === "confirmed" ? t("确认输入质量问题", "Input quality concern confirmed") : decision === "dismissed" ? t("无需处理", "No action needed") : decision === "follow_up" ? t("需跟进", "Follow-up needed") : t("待复核", "Pending review");

  useEffect(() => {
    let live = true;
    Promise.all([api<Check[]>(`/api/projects/${projectId}/checks`), api<Review[]>(`/api/projects/${projectId}/reviews`)]).then(([items, decisions]) => { if (live) { setChecks(items); setReviews(decisions); setSelectedKey(""); setError(""); } }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [projectId]);

  async function submit(decision: Review["decision"]) {
    if (!selected || note.trim().length < 3) return;
    setBusy(true); setError("");
    try {
      const item = await api<Review>(`/api/checks/${selected.check.id}/reviews`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resultIndex: selected.index, decision, note }) });
      setReviews(current => [...current, item]); setSelectedKey(""); setNote("");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return <div className="dl-review"><p className="dl-rules-hint">{t("这里只复核 PDF 输入质量的待确认项。当前证据可定位到页码，尚无可靠的 CAD 对象坐标。复核记录追加保存，不改写规则结果。", "Review PDF input quality findings here. Evidence locates the page, not a CAD object. Decisions are appended without changing rule results.")}</p><div className="dl-review-grid"><section className="dl-card"><div className="dl-card-heading"><h2>{t("待确认项", "Review findings")}</h2><span>{findings.length}</span></div><div className="dl-review-filters"><button className={filter === "all" ? "selected" : ""} onClick={() => { setFilter("all"); setSelectedKey(""); }}>{t("全部", "All")}</button><button className={filter === "pending" ? "selected" : ""} onClick={() => { setFilter("pending"); setSelectedKey(""); }}>{t("待处理", "Pending")}</button><button className={filter === "resolved" ? "selected" : ""} onClick={() => { setFilter("resolved"); setSelectedKey(""); }}>{t("已判断", "Decided")}</button></div><div className="dl-check-list">{visible.length ? visible.map(item => <button key={item.key} className={`dl-check-item ${selected?.key === item.key ? "selected" : ""}`} onClick={() => { setSelectedKey(item.key); setNote(""); onSelectDrawing(item.check.drawingId); }}><strong>{item.result.ruleCode} · {item.result.ruleName}</strong><span>{drawings.find(d => d.id === item.check.drawingId)?.name || item.check.drawingId}{item.result.page ? ` · ${t("第", "Page ")}${item.result.page}${locale === "en" ? "" : " 页"}` : ""} · v{item.check.releaseVersion}</span><small>{decisionText(item.latest?.decision)}</small></button>) : <p className="dl-card-empty">{t("此筛选下没有待确认项", "No findings in this filter")}</p>}</div></section><section className="dl-card"><div className="dl-card-heading"><h2>{t("原始 PDF 页面", "Original PDF page")}</h2><span>{selected?.result.page ? `${t("第", "Page ")}${selected.result.page}${locale === "en" ? "" : " 页"}` : "PDF"}</span></div>{selected ? <iframe className="dl-pdf-frame" src={`/api/drawings/${selected.check.drawingId}/file${selected.result.page ? `#page=${selected.result.page}` : ""}`} title={drawings.find(d => d.id === selected.check.drawingId)?.name || "PDF"}/> : <p className="dl-card-empty">{t("选择待确认项查看对应图纸。", "Select a finding to view its drawing.")}</p>}</section><section className="dl-card"><div className="dl-card-heading"><h2>{t("判断与记录", "Decision and history")}</h2></div>{selected ? <div className="dl-review-detail"><strong>{selected.result.ruleCode} · {selected.result.ruleName}</strong><p>{t("实际值", "Observed")}: {selected.result.observed} · {t("阈值", "Threshold")}: {selected.result.threshold}</p><p>{t("规则版本", "Rules version")}: v{selected.check.releaseVersion}</p><p>{t("当前判断", "Current decision")}: {decisionText(selected.latest?.decision)}</p><label>{t("判断依据", "Reason")}<textarea maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder={t("至少填写 3 个字符", "Enter at least 3 characters")}/></label><div className="dl-review-actions"><button className="dl-secondary" disabled={busy || note.trim().length < 3} onClick={() => submit("dismissed")}>{t("无需处理", "No action")}</button><button className="dl-secondary" disabled={busy || note.trim().length < 3} onClick={() => submit("follow_up")}>{t("需跟进", "Follow up")}</button><button className="dl-primary" disabled={busy || note.trim().length < 3} onClick={() => submit("confirmed")}>{t("确认问题", "Confirm concern")}</button></div>{error && <p className="dl-error" role="alert">{error}</p>}<div className="dl-review-history"><strong>{t("判断历史", "Decision history")}</strong>{history.length ? history.map(item => <p key={item.id}>{new Date(item.reviewedAt).toLocaleString(locale)} · {decisionText(item.decision)}<br/>{item.note}</p>) : <p>{t("尚无判断记录", "No decisions yet")}</p>}</div><p className="dl-check-trace">PDF SHA-256: {selected.check.sourceSha256.slice(0, 16)}…</p></div> : <p className="dl-card-empty">{t("选择待确认项记录判断。", "Select a finding to record a decision.")}</p>}</section></div></div>;
}

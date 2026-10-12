"use client";
import { useEffect, useState } from "react";
import { useLocale } from "../lib/locale";
import RuleSuggestionPanel from "./RuleSuggestionPanel";

type Source = { drawingId: string; page: number; quote: string; sourceSha256: string };
type Rule = { id: string; text: string; status: "candidate" | "accepted" | "rejected"; revision: number; sources: Source[]; updatedAt: string };
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data as T;
}

export default function EngineeringRuleCenter({ categoryId }: { categoryId: string }) {
  const { t, locale } = useLocale();
  const [rules, setRules] = useState<Rule[]>([]);
  const [editing, setEditing] = useState("");
  const [suggesting, setSuggesting] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!categoryId) { setRules([]); return; }
    let live = true;
    api<Rule[]>(`/api/categories/${categoryId}/engineering-rules`).then(items => { if (live) { setRules(items); setError(""); } }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [categoryId]);
  async function change(rule: Rule, status: Rule["status"], changedText?: string) {
    setBusy(true); setError("");
    try {
      const next = await api<Rule>(`/api/engineering-rules/${rule.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, expectedRevision: rule.revision, ...(changedText !== undefined ? { text: changedText } : {}) }) });
      setRules(current => current.map(item => item.id === next.id ? next : item)); setEditing("");
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const statusText = (status: Rule["status"]) => status === "candidate" ? t("待审核", "Candidate") : status === "accepted" ? t("已确认", "Accepted") : t("已忽略", "Rejected");
  return <div className="dl-engineering-rules"><div className="dl-rules-summary"><strong>{t("工程要求规则", "Engineering requirement rules")}</strong><span>{rules.length} {t("条", "items")}</span></div><p className="dl-rules-hint">{t("分析图纸时，服务端 AI 会从可提取的 PDF 文字中生成候选规则并自动归入当前产品类别。请核对来源后确认；这些要求目前尚无对应检查算子，不会参与自动判定。", "When a drawing is analyzed, the selected AI provider adds requirement candidates from extractable PDF text to this category. Verify the source before accepting. These rules have no executable checker yet.")}</p>{error && <p className="dl-error" role="alert">{error}</p>}{rules.length ? <div className="dl-engineering-list">{rules.map(rule => <div className="dl-engineering-item" key={rule.id}><div className="dl-engineering-meta"><span>{statusText(rule.status)} · v{rule.revision || 1}</span><small>{new Date(rule.updatedAt).toLocaleString(locale)}</small></div>{editing === rule.id ? <textarea aria-label={t("工程要求内容", "Requirement text")} maxLength={500} value={text} onChange={e => setText(e.target.value)}/> : <p>{rule.text}</p>}<div className="dl-engineering-source">{rule.sources.map((source, index) => <div key={`${source.drawingId}:${source.page}:${index}`}><a href={`/api/drawings/${source.drawingId}/file#page=${source.page}`} target="_blank" rel="noreferrer">{t("查看原图第", "View page ")}{source.page}{locale === "en" ? "" : " 页"}</a><span>{source.quote}</span></div>)}</div><div className="dl-rule-actions">{editing === rule.id ? <><button className="dl-secondary" onClick={() => setEditing("")}>{t("取消", "Cancel")}</button><button className="dl-primary" disabled={busy || text.trim().length < 8} onClick={() => change(rule, rule.status, text)}>{t("保存文字", "Save text")}</button></> : <><button className="dl-secondary" disabled={busy} onClick={() => { setEditing(rule.id); setText(rule.text); }}>{t("修正", "Edit")}</button><button className="dl-secondary" disabled={busy} onClick={() => { setSuggesting(current => current === rule.id ? "" : rule.id); setEditing(""); }}>{t("AI 建议", "AI suggestion")}</button><button className="dl-secondary" disabled={busy || rule.status === "rejected"} onClick={() => change(rule, "rejected")}>{t("忽略", "Reject")}</button><button className="dl-primary" disabled={busy || rule.status === "accepted"} onClick={() => change(rule, "accepted")}>{t("确认要求", "Accept")}</button></>}</div>{suggesting === rule.id && <RuleSuggestionPanel rule={rule} onApplied={updated => setRules(current => current.map(item => item.id === updated.id ? { ...item, ...updated } : item))}/>}</div>)}</div> : <p className="dl-card-empty">{t("尚无从图纸提取的工程要求。", "No engineering requirements have been extracted yet.")}</p>}</div>;
}

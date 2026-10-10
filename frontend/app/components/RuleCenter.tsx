"use client";
import { useEffect, useState } from "react";
import { useLocale } from "../lib/locale";

type Metric = "min_path_paints_per_page" | "min_text_ops_per_page" | "max_pages";
type Rule = { code: string; name: string; metric: Metric; threshold: number };
type Draft = { rules: Rule[]; baseVersion: number; updatedAt: string };
type Release = { id: string; version: number; rules: Rule[]; sha256: string; publishedAt: string };
type RuleView = { draft: Draft | null; latest: Release | null; releases: Release[] };
const empty: RuleView = { draft: null, latest: null, releases: [] };
const choices: Metric[] = ["min_path_paints_per_page", "min_text_ops_per_page", "max_pages"];
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result as T;
}

export default function RuleCenter({ categoryId }: { categoryId: string }) {
  const { t, locale } = useLocale();
  const [view, setView] = useState<RuleView>(empty);
  const [rules, setRules] = useState<Rule[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [metric, setMetric] = useState<Metric>("min_path_paints_per_page");
  const [threshold, setThreshold] = useState(1);
  const metricLabel = (value: Metric) => value === "min_path_paints_per_page" ? t("每页最少路径绘制次数", "Minimum path paints per page") : value === "min_text_ops_per_page" ? t("每页最少文字操作次数", "Minimum text operations per page") : t("最多页数", "Maximum pages");

  useEffect(() => {
    if (!categoryId) { setView(empty); setRules([]); setDirty(false); return; }
    let live = true;
    api<RuleView>(`/api/categories/${categoryId}/rules`).then(data => { if (live) { setView(data); setRules(data.draft?.rules || data.latest?.rules || []); setDirty(false); setError(""); } }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [categoryId]);

  function addRule(event: React.FormEvent) {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(normalized) || !name.trim() || rules.some(r => r.code === normalized)) { setError(t("规则编号无效或已存在", "Invalid or duplicate rule code")); return; }
    setRules([...rules, { code: normalized, name: name.trim(), metric, threshold }]);
    setCode(""); setName(""); setThreshold(1); setDirty(true); setError("");
  }
  function changeRule(index: number, change: Partial<Rule>) { setRules(current => current.map((rule, position) => position === index ? { ...rule, ...change } : rule)); setDirty(true); }
  async function saveDraft() {
    setBusy(true); setError("");
    try {
      const draft = await api<Draft>(`/api/categories/${categoryId}/rules`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rules }) });
      setView(current => ({ ...current, draft })); setRules(draft.rules); setDirty(false);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function publish() {
    setBusy(true); setError("");
    try {
      await api<Release>(`/api/categories/${categoryId}/rules/publish`, { method: "POST" });
      const current = await api<RuleView>(`/api/categories/${categoryId}/rules`);
      setView(current); setRules(current.latest?.rules || []); setDirty(false);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return <div className="dl-rules">
    {!categoryId ? <p className="dl-card-empty">{t("选择左侧产品类别配置规则。", "Select a product category to configure rules.")}</p> : <>
      <div className="dl-rules-summary"><strong>{t("PDF 输入质量规则", "PDF input quality rules")}</strong><span>{view.latest ? `${t("已发布版本", "Released version")} v${view.latest.version}` : t("尚无发布版本", "No released version")}</span></div>
      <p className="dl-rules-hint">{t("这些规则只检查 PDF 内容流统计。未达到条件时标记“待人工确认”，不判定 CAD 几何不合格。", "These rules inspect PDF content-stream counts. Unmet conditions require review; they do not imply a CAD geometry failure.")}</p>
      <form className="dl-rule-add" onSubmit={addRule}><input aria-label={t("规则编号", "Rule code")} placeholder={t("规则编号，如 PDF_PATH_01", "Code, e.g. PDF_PATH_01")} value={code} maxLength={32} onChange={e => setCode(e.target.value)} required/><input aria-label={t("规则名称", "Rule name")} placeholder={t("规则名称", "Rule name")} value={name} maxLength={80} onChange={e => setName(e.target.value)} required/><select aria-label={t("检查指标", "Metric")} value={metric} onChange={e => setMetric(e.target.value as Metric)}>{choices.map(choice => <option key={choice} value={choice}>{metricLabel(choice)}</option>)}</select><input aria-label={t("阈值", "Threshold")} type="number" min={1} max={100000} value={threshold} onChange={e => setThreshold(Number(e.target.value))}/><button className="dl-secondary" type="submit">{t("添加规则", "Add rule")}</button></form>
      <div className="dl-rule-list">{rules.length ? rules.map((rule, index) => <div className="dl-rule-row" key={rule.code}><strong>{rule.code}</strong><input aria-label={`${rule.code} ${t("名称", "name")}`} value={rule.name} maxLength={80} onChange={e => changeRule(index, { name: e.target.value })}/><select aria-label={`${rule.code} ${t("指标", "metric")}`} value={rule.metric} onChange={e => changeRule(index, { metric: e.target.value as Metric })}>{choices.map(choice => <option key={choice} value={choice}>{metricLabel(choice)}</option>)}</select><input aria-label={`${rule.code} ${t("阈值", "threshold")}`} type="number" min={1} max={100000} value={rule.threshold} onChange={e => changeRule(index, { threshold: Number(e.target.value) })}/><button className="dl-link" onClick={() => { setRules(current => current.filter((_, position) => position !== index)); setDirty(true); }}>{t("删除", "Remove")}</button></div>) : <p className="dl-card-empty">{t("尚无规则。添加后保存草稿。", "No rules yet. Add one and save the draft.")}</p>}</div>
      {error && <p className="dl-error" role="alert">{locale === "en" ? error : ({ "Rules are unchanged": "规则内容未改变", "Save at least one rule before publishing": "至少保存一条规则后才能发布", "Duplicate rule code": "规则编号重复", "Invalid rule fields": "规则字段无效", "Draft is based on an older version": "草稿基于旧版本，请重新保存" } as Record<string,string>)[error] || error}</p>}
      <div className="dl-rule-actions"><button className="dl-secondary" disabled={busy || !dirty} onClick={saveDraft}>{t("保存草稿", "Save draft")}</button><button className="dl-primary" disabled={busy || dirty || !view.draft?.rules.length} onClick={publish}>{t("发布新版本", "Publish new version")}</button></div>
      {view.releases.length > 0 && <div className="dl-rule-history"><strong>{t("发布历史", "Release history")}</strong>{view.releases.map(release => <p key={release.id}>v{release.version} · {release.rules.length} {t("条规则", "rules")} · {new Date(release.publishedAt).toLocaleString(locale)} · {release.sha256.slice(0, 12)}</p>)}</div>}
    </>}
  </div>;
}

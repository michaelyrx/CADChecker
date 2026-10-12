"use client";
import { useEffect, useState } from "react";
import { useLocale } from "../lib/locale";

type Rule = { id: string; text: string; status: "candidate" | "accepted" | "rejected"; revision: number; updatedAt: string };
type Suggestion = { id: string; ruleRevision: number; originalText: string; proposedText?: string; rationale?: string; status: "succeeded" | "failed"; provider: string; model: string; createdAt: string; error?: string };

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body as T;
}

export default function RuleSuggestionPanel({ rule, onApplied }: { rule: Rule; onApplied: (updated: Rule) => void }) {
  const { t, locale } = useLocale();
  const [instruction, setInstruction] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    api<Suggestion[]>(`/api/engineering-rules/${rule.id}/suggestions`).then(items => { if (live) { setSuggestions(items); setSelectedId(items.find(item => item.status === "succeeded")?.id || ""); } }).catch(reason => { if (live) setError(reason.message); });
    return () => { live = false; };
  }, [rule.id]);
  const selected = suggestions.find(item => item.id === selectedId);

  async function generate() {
    setBusy(true); setError("");
    try {
      const result = await api<Suggestion>(`/api/engineering-rules/${rule.id}/suggestions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instruction, expectedRevision: rule.revision }) });
      setSuggestions(current => [result, ...current]); setSelectedId(result.id);
    } catch (reason) {
      setError((reason as Error).message);
      const history = await api<Suggestion[]>(`/api/engineering-rules/${rule.id}/suggestions`).catch(() => null);
      if (history) { setSuggestions(history); setSelectedId(history[0]?.id || ""); }
    }
    finally { setBusy(false); }
  }

  async function apply() {
    if (!selected?.proposedText || selected.ruleRevision !== rule.revision) return;
    setBusy(true); setError("");
    try {
      const updated = await api<Rule>(`/api/engineering-rules/${rule.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: rule.status, text: selected.proposedText, expectedRevision: rule.revision }) });
      onApplied(updated);
    } catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  return <div className="dl-rule-suggestion"><strong>{t("AI 文字修改建议", "AI wording suggestion")}</strong><p className="dl-rules-hint">{t("使用当前启用的模型，仅建议更清晰的表述。数值和单位会自动核对，但仍需人工检查含义及原图来源；建议不会自动生效。", "Uses the active model to suggest clearer wording. Values and units are checked automatically, but meaning and source still need human review. Suggestions do not apply automatically.")}</p><textarea aria-label={t("修改意图", "Wording preference")} maxLength={300} value={instruction} onChange={event => setInstruction(event.target.value)} placeholder={t("可选：说明希望如何改进表述", "Optional: describe the desired wording")}/><button className="dl-secondary" disabled={busy} onClick={generate}>{busy ? t("处理中…", "Working…") : t("生成建议", "Generate suggestion")}</button>{error && <p className="dl-error" role="alert">{error}</p>}{suggestions.length > 0 && <select aria-label={t("建议记录", "Suggestion history")} value={selectedId} onChange={event => setSelectedId(event.target.value)}><option value="">{t("选择建议记录", "Choose a suggestion")}</option>{suggestions.map(item => <option key={item.id} value={item.id}>{new Date(item.createdAt).toLocaleString(locale)} · {item.provider} · {item.status === "succeeded" ? t("可复核", "Ready") : t("失败", "Failed")}</option>)}</select>}{selected && <div className="dl-rule-suggestion-compare"><p><small>{t("生成依据（规则当时版本）", "Original rule at generation")}: v{selected.ruleRevision}</small><br/>{selected.originalText}</p>{selected.status === "succeeded" ? <><p><small>{t("建议文字", "Suggested wording")}</small><br/>{selected.proposedText}</p><p className="dl-rules-hint">{selected.rationale}</p><button className="dl-primary" disabled={busy || selected.ruleRevision !== rule.revision || selected.proposedText === rule.text} onClick={apply}>{t("人工确认并应用", "Review and apply")}</button>{selected.ruleRevision !== rule.revision && <p className="dl-error">{t("规则已更新，此建议基于旧版本。", "This suggestion is based on an older rule revision.")}</p>}</> : <p className="dl-error">{t("模型建议未通过校验", "Model suggestion failed validation")}: {selected.error}</p>}</div>}</div>;
}

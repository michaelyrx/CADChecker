"use client";
import { useEffect, useState } from "react";
import { useLocale } from "../lib/locale";

type Requirement = { ruleId: string; revision: number; text: string; sources: { drawingId: string; page: number; quote: string }[] };
type Decision = "meets" | "does_not_meet" | "not_applicable" | "follow_up";
type Review = { id: string; ruleId: string; decision: Decision; note: string; reviewedAt: string };
type Draft = { decision: Decision; note: string };
const initial: Draft = { decision: "follow_up", note: "" };

export default function EngineeringReviewPanel({ checkRunId, requirements }: { checkRunId: string; requirements: Requirement[] }) {
  const { t, locale } = useLocale();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    setReviews([]); setDrafts({}); setError("");
    fetch(`/api/checks/${checkRunId}/requirement-reviews`).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      if (live) setReviews(data);
    }).catch(reason => { if (live) setError(reason.message); });
    return () => { live = false; };
  }, [checkRunId]);
  const label = (decision: Decision) => decision === "meets" ? t("人工确认符合", "Manually confirmed") : decision === "does_not_meet" ? t("人工确认不符合", "Manually found unmet") : decision === "not_applicable" ? t("不适用", "Not applicable") : t("待跟进", "Follow-up");
  async function save(ruleId: string) {
    const draft = drafts[ruleId] || initial;
    if (!draft.note.trim()) { setError(t("请填写判断依据。", "Enter a reason for the decision.")); return; }
    setBusy(ruleId); setError("");
    try {
      const response = await fetch(`/api/checks/${checkRunId}/requirement-reviews`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ruleId, ...draft }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setReviews(current => [...current, data]);
      setDrafts(current => ({ ...current, [ruleId]: initial }));
    } catch (reason) { setError((reason as Error).message); } finally { setBusy(""); }
  }
  return <section className="dl-engineering-review"><h3>{t("工程要求人工复核", "Engineering requirement review")}</h3><p className="dl-rules-hint">{t("以下要求固定在本次检查记录中。请对照图纸和实际工程证据填写判断依据；系统不会据此自动判定符合。", "These requirements are fixed in this check run. Review the drawing and engineering evidence, then record your reason. The system does not assess compliance automatically.")}</p>{error && <p className="dl-error" role="alert">{error}</p>}{requirements.length ? requirements.map(item => {
    const history = reviews.filter(value => value.ruleId === item.ruleId);
    const latest = history.at(-1);
    const draft = drafts[item.ruleId] || initial;
    return <div className="dl-engineering-item" key={item.ruleId}><div className="dl-engineering-meta"><span>{t("规则修订", "Rule revision")} v{item.revision}</span><small>{latest ? `${label(latest.decision)} · ${new Date(latest.reviewedAt).toLocaleString(locale)}` : t("尚未复核", "Not reviewed")}</small></div><p>{item.text}</p><div className="dl-engineering-source">{item.sources.map((source, index) => <div key={`${source.drawingId}:${source.page}:${index}`}><a href={`/api/drawings/${source.drawingId}/file#page=${source.page}`} target="_blank" rel="noreferrer">{t("来源图纸第", "Source page ")}{source.page}{locale === "en" ? "" : " 页"}</a><span>{source.quote}</span></div>)}</div>{latest && <p className="dl-rules-hint">{label(latest.decision)} · {latest.note}{history.length > 1 ? ` · ${t("历史记录", "History")}: ${history.length}` : ""}</p>}<div className="dl-engineering-review-form"><select aria-label={t("工程要求判断", "Requirement decision")} value={draft.decision} onChange={event => setDrafts(current => ({ ...current, [item.ruleId]: { ...draft, decision: event.target.value as Decision } }))}><option value="follow_up">{label("follow_up")}</option><option value="meets">{label("meets")}</option><option value="does_not_meet">{label("does_not_meet")}</option><option value="not_applicable">{label("not_applicable")}</option></select><textarea aria-label={t("判断依据", "Decision reason")} placeholder={t("填写图纸或工程证据与判断依据", "Describe drawing or engineering evidence and the reason")} maxLength={1000} value={draft.note} onChange={event => setDrafts(current => ({ ...current, [item.ruleId]: { ...draft, note: event.target.value } }))}/><button className="dl-secondary" disabled={!!busy || !draft.note.trim()} onClick={() => save(item.ruleId)}>{busy === item.ruleId ? t("保存中…", "Saving…") : t("保存人工判断", "Save manual decision")}</button></div></div>;
  }) : <p className="dl-card-empty">{t("本次检查没有已确认的工程要求。确认类别规则后，重新运行检查即可纳入。", "No accepted engineering requirements were included. Accept category rules, then run a new check.")}</p>}</section>;
}

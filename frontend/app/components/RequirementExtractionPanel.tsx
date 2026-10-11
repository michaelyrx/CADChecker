"use client";
import { useEffect, useState } from "react";
import { useLocale } from "../lib/locale";

type Extraction = { id: string; analysisRunId: string; status: "running" | "succeeded" | "failed" | "skipped"; importedCount?: number; model: string; error?: string; completedAt?: string; pagesSubmitted?: number; pagesWithText?: number; partialText?: boolean };

export default function RequirementExtractionPanel({ drawingId, analysisRunId, onOpenRules }: { drawingId: string; analysisRunId?: string; onOpenRules: () => void }) {
  const { t, locale } = useLocale();
  const [run, setRun] = useState<Extraction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!drawingId || !analysisRunId) { setRun(null); return; }
    let live = true;
    fetch(`/api/drawings/${drawingId}/requirements`).then(response => response.json()).then((value: Extraction | null) => { if (live) setRun(value?.analysisRunId === analysisRunId ? value : null); }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [drawingId, analysisRunId]);
  async function retry() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/drawings/${drawingId}/requirements`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setRun(data);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (!analysisRunId) return null;
  return <section className="dl-card dl-requirement-panel"><div className="dl-card-heading"><h2>{t("工程要求提取", "Engineering requirements")}</h2><span>{run?.model || "DeepSeek"}</span></div><div className="dl-requirement-body"><p>{run?.status === "succeeded" ? t(`已自动归入类别规则库：新增 ${run.importedCount || 0} 条候选。`, `${run.importedCount || 0} new candidates added to the category rule library.`) : run?.status === "failed" ? t("提取失败，原分析结果已保留。", "Extraction failed; the PDF analysis was preserved.") : run?.status === "skipped" ? t("尚未生成候选规则。", "No requirement candidates were generated.") : t("正在读取工程要求…", "Reading engineering requirements…")}</p>{run?.partialText && <small>{t(`仅提交了 ${run.pagesSubmitted || 0}/${run.pagesWithText || 0} 个含文字的页面或部分页面文字；请检查原图是否有遗漏要求。`, `Only ${run.pagesSubmitted || 0}/${run.pagesWithText || 0} text pages or partial page text was submitted. Check the PDF for omitted requirements.`)}</small>}{run?.error && <small>{locale === "en" ? run.error : ({ "No extractable PDF text": "PDF 中没有可提取文字", "DeepSeek is not configured": "服务端尚未配置 DeepSeek" } as Record<string,string>)[run.error] || run.error}</small>}{error && <p className="dl-error" role="alert">{error}</p>}<div><button className="dl-secondary" disabled={busy} onClick={retry}>{busy ? t("处理中…", "Working…") : t("重新提取", "Extract again")}</button><button className="dl-link" onClick={onOpenRules}>{t("查看类别规则", "View category rules")}</button></div></div></section>;
}

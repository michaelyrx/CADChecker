"use client";
import { useLocale } from "../lib/locale";
import type { BaselineGraph, BaselineGraphItem } from "../lib/store";

const sections: { key: keyof Pick<BaselineGraph, "views" | "features" | "objectRelations" | "annotations" | "annotationRelations">; zh: string; en: string }[] = [
  { key: "views", zh: "已识别视图清单", en: "Recognized views" },
  { key: "features", zh: "已识别基本对象清单", en: "Recognized objects" },
  { key: "objectRelations", zh: "对象之间的关系", en: "Object relationships" },
  { key: "annotations", zh: "已识别标注清单", en: "Recognized annotations" },
  { key: "annotationRelations", zh: "标注—对象关系清单", en: "Annotation to object links" },
];

export default function BaselineGraphView({ graph, baselineId, drawingId, editable, busy, review }: { graph: BaselineGraph; baselineId: string; drawingId: string; editable: boolean; busy: boolean; review: (id: string, value: "confirmed" | "rejected") => void }) {
  const { t } = useLocale();
  const all = [...graph.views, ...graph.features, ...graph.objectRelations, ...graph.annotations, ...graph.annotationRelations];
  const byId = new Map(all.map(item => [item.id, item]));
  const name = (id: string) => byId.get(id)?.label || id;
  const reasons = (item: BaselineGraphItem) => graph.reviewItems.filter(value => value.targetId === item.id).map(value => value.reason);
  return <div className="dl-graph">
    <div className="dl-graph-summary"><strong>{t("对象化学习结果", "Structured learning results")}</strong><span>{t("已处理区域", "Processed regions")}: {graph.coveredRegions.length} · {t("需重点人工确认", "Priority review")}: {graph.reviewItems.filter(value => byId.get(value.targetId)?.review === "pending").length}</span></div>
    <p className="dl-rules-hint">{t("清单来自 AI 对原图区域的识别，位置框和关系均为待复核候选；未建立唯一关联的标注不会自动作为检查规则。", "This inventory is inferred from source-image regions. Locations and links require review; annotations without a unique target are not automatic check rules.")}</p>
    {graph.reviewItems.some(value => byId.get(value.targetId)?.review === "pending") && <section className="dl-graph-review"><h3>{t("需要人工确认的识别", "Recognition requiring human review")}</h3><ul>{graph.reviewItems.filter(value => byId.get(value.targetId)?.review === "pending").map(value => <li key={value.id}><a href={`#graph-${value.targetId}`}>{name(value.targetId)}</a>：{value.reason}</li>)}</ul></section>}
    {sections.map(section => <section key={section.key}><h3>{t(section.zh, section.en)} <small>({graph[section.key].length})</small></h3><div className="dl-graph-scroll"><table className="dl-graph-table"><thead><tr><th>ID / {t("页", "Page")}</th><th>{t("类型与内容", "Type and content")}</th><th>{t("所属视图 / 关系", "View / relationship")}</th><th>{t("状态 / 置信度", "Status / confidence")}</th><th>{t("证据与复核", "Evidence and review")}</th></tr></thead><tbody>{graph[section.key].map(item => <tr key={item.id} id={`graph-${item.id}`}><td><code>{item.id}</code><br/>p.{item.page}</td><td><strong>{item.label}</strong><br/>{item.type}{item.rawText && <p>{t("原文", "Text")}: {item.rawText}</p>}{item.graphics?.length ? <p>{t("标注图元", "Annotation graphics")}: {item.graphics.join("、")}</p> : null}</td><td>{item.viewId && <p>{t("视图", "View")}: {name(item.viewId)}</p>}{item.relation && <p>{item.relation}</p>}{item.sourceIds?.length ? <p>{item.sourceIds.map(name).join(" + ")} → {item.targetIds?.map(name).join(" + ") || t("目标不明", "Target unknown")}</p> : null}{reasons(item).map(reason => <p className="dl-graph-warning" key={reason}>{reason}</p>)}</td><td>{item.review === "confirmed" ? t("已确认", "Confirmed") : item.review === "rejected" ? t("已排除", "Rejected") : t("待确认", "Pending")}<br/>{Math.round(item.confidence * 100)}%</td><td><a href={`/api/drawings/${drawingId}/file#page=${item.page}`} target="_blank" rel="noreferrer">{t("原图", "PDF")}</a>{item.regionId && <a href={`/api/baselines/${baselineId}/regions/${item.regionId}`} target="_blank" rel="noreferrer">{t("识别区域", "Region")}</a>}{item.imageBox && <a href={`/api/baselines/${baselineId}/visual-evidence/${item.id}`} target="_blank" rel="noreferrer">{t("位置框", "Location")}</a>}{editable && <div className="dl-graph-actions"><button disabled={busy} onClick={() => review(item.id, "rejected")}>{t("排除", "Reject")}</button><button disabled={busy} onClick={() => review(item.id, "confirmed")}>{t("确认", "Confirm")}</button></div>}</td></tr>)}{!graph[section.key].length && <tr><td colSpan={5}>{t("该区域未识别到此类内容；不代表原图中不存在。", "None recognized in processed regions; this does not prove absence from the PDF.")}</td></tr>}</tbody></table></div></section>)}
  </div>;
}

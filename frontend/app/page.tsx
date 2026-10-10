"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale, type Locale } from "./lib/locale";

type Category = { id: string; name: string };
type Project = { id: string; name: string; categoryId: string; code: string; description: string };
type PageInventory = { page: number; pathConstruction: number; pathPaint: number; textOperations: number; xobjectDraws: number; status: "vector_content" | "undetermined" };
type Analysis = { status: "running" | "succeeded" | "failed"; runId?: string; pageCount?: number; sha256?: string; pages?: PageInventory[]; error?: string; completedAt?: string };
type Drawing = { id: string; name: string; size: number; uploadedAt: string; analysis?: Analysis };
const sections = ["图纸", "基准学习", "检查任务", "问题复核", "流程", "报告"] as const;
type Section = typeof sections[number];
const english: Record<Section, string> = { 图纸: "Drawings", 基准学习: "Baseline learning", 检查任务: "Inspections", 问题复核: "Issue review", 流程: "Workflow", 报告: "Reports" };
const descriptions: Record<Section, [string, string]> = {
  图纸: ["上传 CAD 导出的矢量 PDF，并查看图纸及版本。", "Upload CAD-exported vector PDFs and manage drawing versions."],
  基准学习: ["从标准图纸提取视图、特征和标注。", "Extract views, features, and annotations from approved drawings."],
  检查任务: ["选择图纸、基准和规则包，跟踪检查进度。", "Choose drawings, baselines, and rules; track inspections."],
  问题复核: ["查看证据、规则依据和 DeepSeek 建议。", "Review evidence, rules, and DeepSeek suggestions."],
  流程: ["配置图纸处理步骤。", "Configure drawing workflows."],
  报告: ["查看检查履历和报告。", "View inspection history and reports."],
};
const chineseErrors: Record<string, string> = {
  "Category name is required": "请输入产品类别名称",
  "Category already exists": "产品类别已存在",
  "Category not found": "产品类别不存在",
  "Project name and category are required": "请输入项目名称并选择类别",
  "Project already exists": "项目名称已存在",
  "Project not found": "项目不存在",
  "Only PDF files are supported": "仅支持 PDF 文件",
  "PDF must be 8 bytes to 25 MB": "PDF 文件大小须在 25 MB 以内",
  "PDF exceeds 25 MB": "PDF 文件超过 25 MB",
  "Invalid PDF header": "文件不是有效的 PDF",
  "Drawing not found": "图纸不存在",
  "Analysis already running": "图纸正在分析中",
  "Python dependency pypdf is missing": "缺少 Python 依赖 pypdf",
  "PDF analysis timed out": "PDF 分析超时",
  "PDF analysis failed": "PDF 分析失败",
};
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result as T;
}

function AnalysisPanel({ analysis }: { analysis?: Analysis }) {
  const { locale, t } = useLocale();
  const totals = analysis?.pages?.reduce((sum, page) => ({ paths: sum.paths + page.pathPaint, text: sum.text + page.textOperations, xobjects: sum.xobjects + page.xobjectDraws }), { paths: 0, text: 0, xobjects: 0 });
  return <section className="dl-card dl-analysis"><div className="dl-card-heading"><h2>{t("矢量内容分析", "Vector content analysis")}</h2><span>{analysis?.status === "succeeded" ? t("已完成", "Complete") : analysis?.status === "running" ? t("分析中", "Running") : analysis?.status === "failed" ? t("失败", "Failed") : t("未开始", "Not started")}</span></div>
    {!analysis && <p className="dl-analysis-note">{t("选择图纸后点击“分析矢量内容”。", "Select a drawing and click Analyze vector content.")}</p>}
    {analysis?.status === "running" && <p className="dl-analysis-note">{t("正在读取 PDF 页面与内容流，请稍候。", "Reading PDF pages and content streams…")}</p>}
    {analysis?.status === "failed" && <p className="dl-analysis-note dl-error">{locale === "en" ? analysis.error : chineseErrors[analysis.error || ""] || analysis.error}</p>}
    {analysis?.status === "succeeded" && <><div className="dl-analysis-stats"><span>{t("页数", "Pages")} <strong>{analysis.pageCount}</strong></span><span>{t("路径绘制", "Path paints")} <strong>{totals?.paths}</strong></span><span>{t("文字操作", "Text ops")} <strong>{totals?.text}</strong></span><span>XObject <strong>{totals?.xobjects}</strong></span></div><div className="dl-analysis-pages">{analysis.pages?.map(page => <div key={page.page} className="dl-analysis-page"><strong>{t("第", "Page ")}{page.page}{locale === "en" ? "" : " 页"}</strong><span>{t("路径绘制", "Paths")}: {page.pathPaint} · {t("文字操作", "Text")}: {page.textOperations} · XObject: {page.xobjectDraws}</span><em>{page.status === "vector_content" ? t("发现矢量内容", "Vector content found") : t("内容待确认", "Content undetermined")}</em></div>)}</div><p className="dl-analysis-note">SHA-256: <code title={analysis.sha256}>{analysis.sha256?.slice(0, 16)}…</code><br/>{t("此处仅统计 PDF 操作符，不代表 CAD 几何、尺寸或标注规则已通过。", "This inventory counts PDF operators only; it does not validate CAD geometry, dimensions, or annotations.")}</p></>}
  </section>;
}

export default function Home() {
  const { locale, setLocale, t } = useLocale();
  const [categories, setCategories] = useState<Category[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [projectId, setProjectId] = useState("");
  const [drawingId, setDrawingId] = useState("");
  const [categoryView, setCategoryView] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [section, setSection] = useState<Section>("图纸");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const project = projects.find(p => p.id === projectId);
  const drawing = drawings.find(d => d.id === drawingId);
  const category = categories.find(c => c.id === project?.categoryId);
  const label = (s: Section) => t(s, english[s]);
  const errorText = locale === "en" ? error : chineseErrors[error] || error;
  const analysisStatus = drawing?.analysis?.status;

  useEffect(() => {
    let live = true;
    Promise.all([api<Category[]>("/api/categories"), api<Project[]>("/api/projects")])
      .then(([cats, items]) => { if (!live) return; setCategories(cats); setProjects(items); const saved = localStorage.getItem("cadlint.activeProject.v1"); setProjectId(items.find(p => p.id === saved)?.id || items[0]?.id || ""); })
      .catch(e => { if (live) setError(e.message); })
      .finally(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!projectId) { setDrawings([]); setDrawingId(""); return; }
    let live = true;
    api<Drawing[]>(`/api/projects/${projectId}/drawings`).then(items => { if (live) { setDrawings(items); setDrawingId(items[0]?.id || ""); } }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [projectId]);
  useEffect(() => {
    if (!drawingId || analysisStatus !== "running") return;
    const timer = setInterval(() => {
      api<Analysis>(`/api/drawings/${drawingId}/analysis`).then(analysis => setDrawings(current => current.map(item => item.id === drawingId ? { ...item, analysis } : item))).catch(() => undefined);
    }, 3000);
    return () => clearInterval(timer);
  }, [drawingId, analysisStatus]);

  async function addCategory(event: React.FormEvent) {
    event.preventDefault(); if (!newCategory.trim()) return;
    setBusy(true); setError("");
    try { const item = await api<Category>("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newCategory }) }); setCategories([...categories, item]); setSelectedCategory(item.id); setCategoryId(item.id); setNewCategory(""); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function createProject(event: React.FormEvent) {
    event.preventDefault(); if (!name.trim() || !categoryId) { setError(t("请输入项目名称并选择类别", "Enter a name and choose a category")); return; }
    setBusy(true); setError("");
    try { const item = await api<Project>("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, categoryId, code, description }) }); setProjects([...projects, item]); setProjectId(item.id); localStorage.setItem("cadlint.activeProject.v1", item.id); setCreating(false); setCategoryView(false); setSection("图纸"); setName(""); setCode(""); setDescription(""); setCategoryId(""); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function upload(file?: File) {
    if (!file || !projectId) return; setBusy(true); setError("");
    try { const body = new FormData(); body.append("file", file); const item = await api<Drawing>(`/api/projects/${projectId}/drawings`, { method: "POST", body }); setDrawings([...drawings, item]); setDrawingId(item.id); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  }
  async function analyze() {
    if (!drawingId) return;
    setBusy(true); setError("");
    setDrawings(current => current.map(item => item.id === drawingId ? { ...item, analysis: { status: "running" } } : item));
    try {
      const analysis = await api<Analysis>(`/api/drawings/${drawingId}/analysis`, { method: "POST" });
      setDrawings(current => current.map(item => item.id === drawingId ? { ...item, analysis } : item));
    } catch (e) {
      setError((e as Error).message);
      api<Analysis>(`/api/drawings/${drawingId}/analysis`).then(analysis => setDrawings(current => current.map(item => item.id === drawingId ? { ...item, analysis } : item))).catch(() => undefined);
    } finally { setBusy(false); }
  }
  function switchProject(id: string) { setProjectId(id); setDrawingId(""); setSection("图纸"); setError(""); localStorage.setItem("cadlint.activeProject.v1", id); }

  return <div className="dl-shell">
    <header className="dl-header"><div className="dl-logo" aria-label="CADLint"><span className="dl-logo-icon"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 4h15l4 4v20H7z"/><path d="M22 4v5h4M11 13h11M11 18h7"/><path d="m16 24 3 3 5-6"/></svg></span><span>CAD<span className="dl-logo-accent">Lint</span></span></div><span className="dl-header-divider"/><span className="dl-product">{t("矢量图纸智能检查", "Vector drawing inspection")}</span><span className="dl-header-fill"/><button className="dl-global-link" onClick={() => { setCategoryView(true); setError(""); }}>{t("产品类别与规则", "Categories & rules")}</button><select className="dl-locale" aria-label={t("界面语言", "Interface language")} value={locale} onChange={e => setLocale(e.target.value as Locale)}><option value="zh-CN">简体中文</option><option value="en">English</option></select></header>
    {!ready ? <main className="dl-onboard">{t("正在打开项目…", "Opening projects…")}</main> : categoryView ? <main className="dl-global"><div className="dl-eyebrow">GLOBAL SETTINGS</div><h1>{t("产品类别与规则", "Product categories and rules")}</h1><p>{t("类别跨项目共用，项目使用所属类别的规则包。", "Categories are shared across projects; each project uses its category's rules.")}</p><div className="dl-global-grid"><section className="dl-card"><div className="dl-card-heading"><h2>{t("产品类别", "Product categories")}</h2><span>{categories.length}</span></div><div className="dl-category-list">{categories.length ? categories.map(c => <button key={c.id} className={`dl-category-item ${selectedCategory === c.id ? "selected" : ""}`} onClick={() => setSelectedCategory(c.id)}>{c.name}</button>) : <p>{t("尚无产品类别", "No product categories yet")}</p>}</div><form className="dl-category-form" onSubmit={addCategory}><input aria-label={t("新产品类别", "New category")} value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder={t("例如：蒸发器总成", "e.g. Evaporator assembly")}/><button className="dl-primary" disabled={busy}>{t("添加类别", "Add category")}</button></form></section><section className="dl-card"><div className="dl-card-heading"><h2>{t("类别规则包", "Category rule packages")}</h2></div><div className="dl-card-empty">{categories.find(c => c.id === selectedCategory) ? <><strong>{categories.find(c => c.id === selectedCategory)?.name}</strong><p>{t("规则编辑、试运行和发布将在下一批次接入。", "Rule editing, testing, and release are planned for the next batch.")}</p></> : t("选择左侧产品类别查看规则包。", "Choose a category to view its rules.")}</div></section></div>{error && <p className="dl-error" role="alert">{errorText}</p>}<button className="dl-secondary dl-back" onClick={() => setCategoryView(false)}>{t("返回项目", "Back to project")}</button></main> : !project ? <main className="dl-onboard"><div className="dl-eyebrow">GET STARTED</div><h1>{t("创建第一个项目", "Create your first project")}</h1><p>{t("先创建产品类别，再创建项目并上传矢量 PDF。", "Create a product category, then a project, and upload vector PDFs.")}</p>{error && <p className="dl-error" role="alert">{errorText}</p>}<button className="dl-primary" onClick={() => { setCreating(true); setError(""); }}>{t("＋ 创建项目", "+ Create project")}</button></main> : <><div className="dl-projectbar"><label htmlFor="project-picker">{t("当前项目", "Current project")}</label><select id="project-picker" value={projectId} onChange={e => switchProject(e.target.value)}>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><button className="dl-link" onClick={() => { setCreating(true); setError(""); }}>{t("＋ 新建项目", "+ New project")}</button><span className="dl-projectbar-fill"/><span className="dl-project-code">{category?.name}</span><span className="dl-project-code">{project.code || t("未设置项目编号", "No project code")}</span></div><div className="dl-workspace"><nav className="dl-sidebar" aria-label={t("项目功能", "Project navigation")}><div className="dl-sidebar-label">PROJECT WORKSPACE</div>{sections.map(s => <button key={s} className={`dl-nav-item ${section === s ? "dl-active" : ""}`} onClick={() => setSection(s)}>{label(s)}</button>)}<div className="dl-sidebar-foot">{t("当前项目", "Current project")}<strong>{project.name}</strong><small>{category?.name}</small></div></nav><main className="dl-content"><div className="dl-breadcrumb">{project.name} / {label(section)}</div><div className="dl-heading"><div><div className="dl-eyebrow">{section === "图纸" ? "DRAWING LIBRARY" : "PROJECT WORKSPACE"}</div><h1>{label(section)}</h1><p>{descriptions[section][locale === "en" ? 1 : 0]}</p></div>{section === "图纸" ? <><input ref={fileInput} className="dl-hidden" type="file" accept="application/pdf,.pdf" onChange={e => upload(e.target.files?.[0])}/><button className="dl-primary" disabled={busy} onClick={() => fileInput.current?.click()}>{busy ? t("处理中…", "Working…") : t("＋ 上传 PDF", "+ Upload PDF")}</button><button className="dl-secondary" disabled={!drawing || busy || analysisStatus === "running"} onClick={analyze}>{t("分析矢量内容", "Analyze vector content")}</button></> : <button className="dl-primary" disabled>{t("＋ 新建", "+ New")}</button>}</div>{error && <p className="dl-error" role="alert">{errorText}</p>}{section === "图纸" ? <><div className="dl-columns"><section className="dl-card dl-files"><div className="dl-card-heading"><h2>{t("项目图纸", "Project drawings")}</h2><span>{drawings.length} {t("份", "files")}</span></div><div className="dl-drawing-list">{drawings.length ? drawings.map(d => <button key={d.id} className={`dl-drawing-item ${drawingId === d.id ? "selected" : ""}`} onClick={() => setDrawingId(d.id)}><strong>{d.name}</strong><small>{(d.size / 1024 / 1024).toFixed(2)} MB · {d.analysis?.status === "succeeded" ? t("已分析", "Analyzed") : d.analysis?.status === "running" ? t("分析中", "Running") : d.analysis?.status === "failed" ? t("分析失败", "Failed") : t("待分析", "Not analyzed")}</small></button>) : <div className="dl-card-empty">{t("项目中还没有图纸", "No drawings in this project yet")}</div>}</div></section><section className="dl-card dl-preview"><div className="dl-card-heading"><h2>{t("图纸预览", "Drawing preview")}</h2><span>PDF</span></div>{drawing ? <iframe className="dl-pdf-frame" src={`/api/drawings/${drawing.id}/file`} title={drawing.name}/> : <div className="dl-preview-empty"><div className="dl-preview-icon">▧</div><strong>{t("从上传图纸开始", "Start by uploading a drawing")}</strong><p>{t("上传 CAD 系统导出的 PDF 后，在此预览原始页面。", "Upload a CAD-exported PDF to preview its pages here.")}</p></div>}</section><aside className="dl-card dl-detail"><div className="dl-card-heading"><h2>{t("详情", "Details")}</h2></div><div className="dl-card-empty">{drawing ? <><strong>{drawing.name}</strong><p>{t("上传时间", "Uploaded")}: {new Date(drawing.uploadedAt).toLocaleString(locale)}</p><p>{t("文件大小", "Size")}: {(drawing.size / 1024 / 1024).toFixed(2)} MB</p><p>{drawing.analysis?.status === "succeeded" ? t("矢量内容已分析", "Vector content analyzed") : t("矢量分析待执行", "Vector analysis pending")}</p></> : t("选择图纸查看详情。", "Select a drawing to view details.")}</div></aside></div><AnalysisPanel analysis={drawing?.analysis}/></> : <div className="dl-card dl-section-empty"><span className="dl-section-icon">◇</span><h2>{t(`${section}尚无内容`, `No ${english[section].toLowerCase()} yet`)}</h2><p>{descriptions[section][locale === "en" ? 1 : 0]}</p><span>{t("将在后续批次接入。", "Coming in a later batch.")}</span></div>}</main></div></>}
    {creating && <div className="dl-overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setCreating(false); }}><div className="dl-dialog" role="dialog" aria-modal="true" aria-labelledby="create-title"><div className="dl-dialog-head"><div><div className="dl-eyebrow">NEW PROJECT</div><h2 id="create-title">{t("创建项目", "Create project")}</h2></div><button className="dl-close" aria-label={t("关闭", "Close")} onClick={() => setCreating(false)}>×</button></div><p>{t("项目关联一个产品类别，使用该类别的规则包。", "Each project belongs to one category and uses its rules.")}</p><form onSubmit={createProject}><label>{t("项目名称", "Project name")} <b>*</b><input autoFocus maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder={t("例如：HVAC 蒸发器项目", "e.g. HVAC Evaporator")}/></label><label>{t("产品类别", "Product category")} <b>*</b><select value={categoryId} onChange={e => setCategoryId(e.target.value)}><option value="">{t("选择产品类别", "Choose a category")}</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button type="button" className="dl-link dl-inline-link" onClick={() => { setCreating(false); setCategoryView(true); }}>{t("管理产品类别", "Manage categories")}</button></label><label>{t("项目编号", "Project code")} <span>{t("选填", "Optional")}</span><input maxLength={40} value={code} onChange={e => setCode(e.target.value)}/></label><label>{t("项目说明", "Description")} <span>{t("选填", "Optional")}</span><textarea maxLength={300} value={description} onChange={e => setDescription(e.target.value)}/></label>{error && <div className="dl-error" role="alert">{errorText}</div>}<div className="dl-dialog-actions"><button type="button" className="dl-secondary" onClick={() => setCreating(false)}>{t("取消", "Cancel")}</button><button className="dl-primary" disabled={busy}>{t("创建并进入项目", "Create and open project")}</button></div></form></div></div>}
  </div>;
}

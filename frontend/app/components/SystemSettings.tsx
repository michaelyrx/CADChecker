"use client";
import { useEffect, useState } from "react";
import { useLocale } from "../lib/locale";

type Provider = "deepseek" | "bedrock";
type ProviderStatus = { configured: boolean; model: string; region?: string };
type Status = { provider: string; configured: boolean; model: string; source: "saved" | "environment"; updatedAt?: string; providers: Record<Provider, ProviderStatus> };

async function statusRequest(options?: RequestInit): Promise<Status> {
  const response = await fetch("/api/ai/status", options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

export default function SystemSettings() {
  const { locale, t } = useLocale();
  const [status, setStatus] = useState<Status | null>(null);
  const [selected, setSelected] = useState<Provider>("deepseek");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let live = true;
    statusRequest().then(value => { if (live) { setStatus(value); setSelected(value.provider === "bedrock" ? "bedrock" : "deepseek"); } }).catch(reason => { if (live) setError(reason.message); });
    return () => { live = false; };
  }, []);

  async function save() {
    setSaving(true); setError(""); setSaved(false);
    try {
      const value = await statusRequest({ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: selected }) });
      setStatus(value); setSaved(true);
    } catch (reason) { setError((reason as Error).message); }
    finally { setSaving(false); }
  }

  return <section className="dl-card dl-system-settings"><div className="dl-card-heading"><h2>{t("AI 模型服务", "AI model provider")}</h2><span>{status?.source === "saved" ? t("系统配置", "System setting") : t("环境默认", "Environment default")}</span></div>
    <div className="dl-system-body"><p className="dl-rules-hint">{t("此设置对所有项目生效。选择服务后，新的工程要求提取、基准学习、图纸对比和 AI 建议会调用该服务；已有记录保持原服务信息。", "This setting applies to every project. New requirement extraction, baseline learning, drawing comparisons, and AI advice use the selected provider. Existing records keep their provider details.")}</p>
      {status ? <><div className="dl-provider-options">{(["deepseek", "bedrock"] as Provider[]).map(provider => { const info = status.providers[provider]; return <label key={provider} className={`dl-provider-option ${selected === provider ? "selected" : ""}`}><input type="radio" name="ai-provider" value={provider} checked={selected === provider} onChange={() => { setSelected(provider); setSaved(false); }}/><span><strong>{provider === "deepseek" ? "DeepSeek API" : "Amazon Bedrock"}</strong><small>{info.configured ? t("服务端基础配置已就绪", "Server configuration present") : t("服务端配置未齐全", "Server configuration incomplete")}</small><small>{t("模型", "Model")}: {info.model || "—"}{info.region ? ` · ${info.region}` : ""}</small></span></label>; })}</div>
        <p className="dl-rules-hint">{t("API 密钥和 AWS 凭证仅由服务端环境提供，此页面不会保存或显示密钥。“配置已就绪”不代表真实模型调用已验证。", "API keys and AWS credentials stay in the server environment; this page does not store or show them. Configuration present does not verify a real model call.")}</p>
        {selected !== status.provider && !status.providers[selected].configured && <p className="dl-error">{t("该服务尚缺少必要的服务端配置。保存后，相关 AI 功能在配置完成前无法调用。", "This provider is missing required server configuration. AI features will remain unavailable after saving until it is configured.")}</p>}
        {error && <p className="dl-error" role="alert">{error}</p>}{saved && <p className="dl-system-success" role="status">{t("已保存，新的 AI 任务将使用所选服务。", "Saved. New AI tasks will use the selected provider.")}</p>}
        <div className="dl-system-actions"><span>{t("当前启用", "Active")}: <strong>{status.provider === "bedrock" ? "Amazon Bedrock" : "DeepSeek API"}</strong>{status.updatedAt ? ` · ${new Date(status.updatedAt).toLocaleString(locale)}` : ""}</span><button className="dl-primary" disabled={saving || selected === status.provider} onClick={save}>{saving ? t("保存中…", "Saving…") : t("启用所选服务", "Activate provider")}</button></div></> : !error && <p className="dl-card-empty">{t("正在读取配置…", "Loading settings…")}</p>}
      {!status && error && <p className="dl-error" role="alert">{error}</p>}
    </div></section>;
}

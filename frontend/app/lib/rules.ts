import type { Analysis, CheckResult, QualityRule, RuleMetric } from "./store";

const metrics: RuleMetric[] = ["min_path_paints_per_page", "min_text_ops_per_page", "max_pages"];

export function validateRules(value: unknown): QualityRule[] {
  if (!Array.isArray(value) || value.length > 30) throw new Error("Rules must be a list of at most 30 items");
  const seen = new Set<string>();
  return value.map(entry => {
    if (!entry || typeof entry !== "object") throw new Error("Invalid rule");
    const rule = entry as Record<string, unknown>;
    const code = typeof rule.code === "string" ? rule.code.trim().toUpperCase() : "";
    const name = typeof rule.name === "string" ? rule.name.trim() : "";
    if (!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(code) || !name || name.length > 80 || !metrics.includes(rule.metric as RuleMetric) || !Number.isInteger(rule.threshold) || Number(rule.threshold) < 1 || Number(rule.threshold) > 100000) throw new Error("Invalid rule fields");
    if (seen.has(code)) throw new Error("Duplicate rule code");
    seen.add(code);
    return { code, name, metric: rule.metric as RuleMetric, threshold: Number(rule.threshold) };
  });
}

export function evaluateRules(rules: QualityRule[], analysis: Analysis): CheckResult[] {
  if (analysis.status !== "succeeded" || !analysis.pages?.length) throw new Error("Drawing analysis is required");
  return rules.flatMap(rule => {
    if (rule.metric === "max_pages") {
      const observed = analysis.pages!.length;
      return [{ ruleCode: rule.code, ruleName: rule.name, observed, threshold: rule.threshold, status: observed <= rule.threshold ? "PASS" : "REVIEW" as const }];
    }
    return analysis.pages!.map(page => {
      const observed = rule.metric === "min_path_paints_per_page" ? page.pathPaint : page.textOperations;
      return { ruleCode: rule.code, ruleName: rule.name, page: page.page, observed, threshold: rule.threshold, status: observed >= rule.threshold ? "PASS" : "REVIEW" as const };
    });
  });
}

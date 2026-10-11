import type { Database, RequirementSnapshot } from "./store";

export function snapshotEngineeringRequirements(db: Database, categoryId: string): RequirementSnapshot[] {
  return db.engineeringRules
    .filter(rule => rule.categoryId === categoryId && rule.status === "accepted")
    .map(rule => ({ ruleId: rule.id, revision: rule.revision, text: rule.text, sources: structuredClone(rule.sources) }));
}

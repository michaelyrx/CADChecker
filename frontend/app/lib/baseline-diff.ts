import { randomUUID } from "node:crypto";
import type { BaselineDifference, DrawingFact } from "./store";

const key = (fact: DrawingFact) => `${fact.kind}:${fact.quote.replace(/\s+/g, " ").trim().toLocaleLowerCase()}`;
const reference = (fact: DrawingFact) => ({ id: fact.id, page: fact.page, quote: fact.quote, sourceMethod: fact.sourceMethod, textOrigin: fact.textOrigin, imageBox: fact.imageBox });
const distance = (a: DrawingFact, b: DrawingFact) => a.textOrigin && b.textOrigin ? Math.hypot(a.textOrigin.x - b.textOrigin.x, a.textOrigin.y - b.textOrigin.y) : 0;
const cost = (a: DrawingFact, b: DrawingFact) => (a.page === b.page ? 0 : 1_000_000_000 + Math.abs(a.page - b.page) * 1_000_000) + Math.min(distance(a, b), 100_000);

function optimalPairs(baseline: DrawingFact[], target: DrawingFact[]) {
  const swapped = baseline.length > target.length;
  const rows = swapped ? target : baseline;
  const columns = swapped ? baseline : target;
  const u = Array(rows.length + 1).fill(0);
  const v = Array(columns.length + 1).fill(0);
  const p = Array(columns.length + 1).fill(0);
  const way = Array(columns.length + 1).fill(0);
  for (let i = 1; i <= rows.length; i++) {
    p[0] = i;
    let j0 = 0;
    const min = Array(columns.length + 1).fill(Infinity);
    const used = Array(columns.length + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= columns.length; j++) {
        if (used[j]) continue;
        const value = cost(rows[i0 - 1], columns[j - 1]) - u[i0] - v[j];
        if (value < min[j]) { min[j] = value; way[j] = j0; }
        if (min[j] < delta) { delta = min[j]; j1 = j; }
      }
      for (let j = 0; j <= columns.length; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else min[j] -= delta;
      }
      j0 = j1;
    } while (p[j0]);
    do { const previous = way[j0]; p[j0] = p[previous]; j0 = previous; } while (j0);
  }
  return p.flatMap((row, column) => row && column ? [swapped ? { baseline: column - 1, target: row - 1 } : { baseline: row - 1, target: column - 1 }] : []);
}

export function compareFacts(baselineFacts: DrawingFact[], targetFacts: DrawingFact[]): BaselineDifference[] {
  const groups = new Map<string, { baseline: DrawingFact[]; target: DrawingFact[] }>();
  for (const fact of baselineFacts.filter(item => item.review === "confirmed")) {
    const group = groups.get(key(fact)) || { baseline: [], target: [] };
    group.baseline.push(fact);
    groups.set(key(fact), group);
  }
  for (const fact of targetFacts) {
    const group = groups.get(key(fact)) || { baseline: [], target: [] };
    group.target.push(fact);
    groups.set(key(fact), group);
  }
  const differences: BaselineDifference[] = [];
  for (const group of groups.values()) {
    const baseline = [...group.baseline];
    const target = [...group.target];
    if (baseline.length && target.length && [...baseline, ...target].some(fact => !fact.textOrigin)) {
      if (baseline.length === 1 && target.length === 1) {
        differences.push({ id: randomUUID(), status: "ambiguous", kind: baseline[0].kind, baseline: reference(baseline[0]), target: reference(target[0]), confidence: 0.35, reviewRequired: true });
        continue;
      }
      for (const fact of baseline) differences.push({ id: randomUUID(), status: "ambiguous", kind: fact.kind, baseline: reference(fact), confidence: 0.35, reviewRequired: true });
      for (const fact of target) differences.push({ id: randomUUID(), status: "ambiguous", kind: fact.kind, target: reference(fact), confidence: 0.35, reviewRequired: true });
      continue;
    }
    const pairs = optimalPairs(baseline, target);
    const matchedBaseline = new Set(pairs.map(pair => pair.baseline));
    const matchedTarget = new Set(pairs.map(pair => pair.target));
    for (const pair of pairs) {
      const original = baseline[pair.baseline];
      const candidate = target[pair.target];
      const status = original.page !== candidate.page ? "moved" : original.textOrigin && candidate.textOrigin && distance(original, candidate) > 24 ? "position_changed" : "matched";
      differences.push({ id: randomUUID(), status, kind: original.kind, baseline: reference(original), target: reference(candidate), confidence: status === "position_changed" ? 0.6 : 0.7, reviewRequired: true });
    }
    for (const [index, fact] of baseline.entries()) if (!matchedBaseline.has(index)) differences.push({ id: randomUUID(), status: "removed", kind: fact.kind, baseline: reference(fact), confidence: 0.7, reviewRequired: true });
    for (const [index, fact] of target.entries()) if (!matchedTarget.has(index)) differences.push({ id: randomUUID(), status: "added", kind: fact.kind, target: reference(fact), confidence: 0.7, reviewRequired: true });
  }
  return differences;
}

import { failure, readDb, updateDb } from "@/app/lib/store";
import { validateRules } from "@/app/lib/rules";
export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const db = await readDb();
  if (!db.categories.some(c => c.id === id)) return failure("Category not found", 404);
  const releases = db.ruleReleases.filter(r => r.categoryId === id).sort((a, b) => b.version - a.version);
  return Response.json({ draft: db.ruleDrafts.find(d => d.categoryId === id) || null, latest: releases[0] || null, releases });
}

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return failure("Invalid JSON"); }
  let rules;
  try { rules = validateRules((body as { rules?: unknown })?.rules); } catch (error) { return failure((error as Error).message); }
  try {
    const draft = await updateDb(db => {
      if (!db.categories.some(c => c.id === id)) throw new Error("Category not found");
      const latest = db.ruleReleases.filter(r => r.categoryId === id).sort((a, b) => b.version - a.version)[0];
      const item = { categoryId: id, baseVersion: latest?.version || 0, rules, updatedAt: new Date().toISOString() };
      db.ruleDrafts = db.ruleDrafts.filter(d => d.categoryId !== id).concat(item);
      return item;
    });
    return Response.json(draft);
  } catch (error) {
    if ((error as Error).message === "Category not found") return failure("Category not found", 404);
    throw error;
  }
}

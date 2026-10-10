import { createHash, randomUUID } from "node:crypto";
import { failure, updateDb } from "@/app/lib/store";
export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const release = await updateDb(db => {
      if (!db.categories.some(c => c.id === id)) throw new Error("Category not found");
      const draft = db.ruleDrafts.find(d => d.categoryId === id);
      if (!draft?.rules.length) throw new Error("Save at least one rule before publishing");
      const latest = db.ruleReleases.filter(r => r.categoryId === id).sort((a, b) => b.version - a.version)[0];
      if (draft.baseVersion !== (latest?.version || 0)) throw new Error("Draft is based on an older version");
      const sha256 = createHash("sha256").update(JSON.stringify(draft.rules)).digest("hex");
      if (latest?.sha256 === sha256) throw new Error("Rules are unchanged");
      const item = { id: randomUUID(), categoryId: id, version: (latest?.version || 0) + 1, rules: structuredClone(draft.rules), sha256, publishedAt: new Date().toISOString() };
      db.ruleReleases.push(item);
      db.ruleDrafts = db.ruleDrafts.filter(d => d.categoryId !== id);
      return item;
    });
    return Response.json(release, { status: 201 });
  } catch (error) {
    const message = (error as Error).message;
    if (message === "Category not found") return failure(message, 404);
    if (["Save at least one rule before publishing", "Draft is based on an older version", "Rules are unchanged"].includes(message)) return failure(message, 409);
    throw error;
  }
}

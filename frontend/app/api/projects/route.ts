import { randomUUID } from "node:crypto";
import { cleanText, failure, readDb, updateDb } from "@/app/lib/store";
export const runtime = "nodejs";

export async function GET() {
  const db = await readDb();
  return Response.json(db.projects);
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return failure("Invalid JSON"); }
  const input = body as Record<string, unknown> | null;
  const name = cleanText(input?.name, 80);
  const categoryId = cleanText(input?.categoryId, 80);
  if (!name || !categoryId) return failure("Project name and category are required");
  try {
    const item = await updateDb(db => {
      if (!db.categories.some(c => c.id === categoryId)) throw new Error("Category not found");
      if (db.projects.some(p => p.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error("Project already exists");
      const project = { id: randomUUID(), name, categoryId, code: cleanText(input?.code, 40), description: cleanText(input?.description, 300), createdAt: new Date().toISOString() };
      db.projects.push(project);
      return project;
    });
    return Response.json(item, { status: 201 });
  } catch (error) {
    if ((error as Error).message === "Category not found") return failure("Category not found", 404);
    if ((error as Error).message === "Project already exists") return failure("Project already exists", 409);
    throw error;
  }
}

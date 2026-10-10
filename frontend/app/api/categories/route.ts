import { randomUUID } from "node:crypto";
import { cleanText, failure, readDb, updateDb } from "@/app/lib/store";
export const runtime = "nodejs";

export async function GET() {
  const db = await readDb();
  return Response.json(db.categories);
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return failure("Invalid JSON"); }
  const name = cleanText((body as { name?: unknown })?.name, 80);
  if (!name) return failure("Category name is required");
  try {
    const item = await updateDb(db => {
      if (db.categories.some(c => c.name.toLocaleLowerCase() === name.toLocaleLowerCase())) throw new Error("Category already exists");
      const category = { id: randomUUID(), name, createdAt: new Date().toISOString() };
      db.categories.push(category);
      return category;
    });
    return Response.json(item, { status: 201 });
  } catch (error) {
    if ((error as Error).message === "Category already exists") return failure("Category already exists", 409);
    throw error;
  }
}

import { failure, readDb } from "@/app/lib/store";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await readDb();
  if (!db.categories.some(item => item.id === id)) return failure("Category not found", 404);
  return Response.json(db.engineeringRules.filter(item => item.categoryId === id).reverse());
}

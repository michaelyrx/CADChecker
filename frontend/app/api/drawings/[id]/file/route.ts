import { readFile } from "node:fs/promises";
import path from "node:path";
import { dataDir, failure, readDb } from "@/app/lib/store";
export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await readDb();
  if (!db.drawings.some(d => d.id === id)) return failure("Drawing not found", 404);
  try {
    const bytes = await readFile(path.join(dataDir, "uploads", `${id}.pdf`));
    return new Response(bytes, { headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return failure("Drawing file not found", 404);
    throw error;
  }
}

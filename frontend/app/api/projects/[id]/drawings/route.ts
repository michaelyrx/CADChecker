import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir, failure, readDb, updateDb } from "@/app/lib/store";
export const runtime = "nodejs";
const maxBytes = 25 * 1024 * 1024;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await readDb();
  if (!db.projects.some(p => p.id === id)) return failure("Project not found", 404);
  return Response.json(db.drawings.filter(d => d.projectId === id));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const length = Number(request.headers.get("content-length"));
  if (length > maxBytes + 1024 * 1024) return failure("PDF exceeds 25 MB", 413);
  const db = await readDb();
  if (!db.projects.some(p => p.id === id)) return failure("Project not found", 404);
  let form: FormData;
  try { form = await request.formData(); } catch { return failure("Invalid upload"); }
  const file = form.get("file");
  if (!(file instanceof File)) return failure("PDF file is required");
  if (!file.name.toLowerCase().endsWith(".pdf")) return failure("Only PDF files are supported");
  if (file.size < 8 || file.size > maxBytes) return failure("PDF must be 8 bytes to 25 MB", file.size > maxBytes ? 413 : 400);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 5).toString() !== "%PDF-") return failure("Invalid PDF header");
  const item = { id: randomUUID(), projectId: id, name: file.name.slice(0, 160), size: file.size, uploadedAt: new Date().toISOString() };
  const directory = path.join(dataDir, "uploads");
  const destination = path.join(directory, `${item.id}.pdf`);
  await mkdir(directory, { recursive: true });
  await writeFile(destination, bytes, { flag: "wx" });
  try {
    await updateDb(current => {
      if (!current.projects.some(p => p.id === id)) throw new Error("Project not found");
      current.drawings.push(item);
    });
  } catch (error) {
    await unlink(destination).catch(() => undefined);
    if ((error as Error).message === "Project not found") return failure("Project not found", 404);
    throw error;
  }
  return Response.json(item, { status: 201 });
}

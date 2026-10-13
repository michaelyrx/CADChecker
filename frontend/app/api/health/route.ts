import { access, constants } from "node:fs/promises";
import { dataDir } from "../../lib/store";

export const runtime = "nodejs";

export async function GET() {
  try {
    await access(dataDir, constants.R_OK | constants.W_OK);
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "storage_unavailable" }, { status: 503 });
  }
}

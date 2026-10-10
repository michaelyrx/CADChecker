import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blankPdf, vectorPdf } from "./pdf-fixtures.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const samples = path.join(root, ".local-verification", "samples");
await mkdir(samples, { recursive: true });
await writeFile(path.join(samples, "vector-line.pdf"), vectorPdf);
await writeFile(path.join(samples, "blank-page.pdf"), blankPdf);
console.log(`Sample PDFs: ${samples}`);

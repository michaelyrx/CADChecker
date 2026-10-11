import { Buffer } from "node:buffer";

/** A tiny, valid one-page PDF with the supplied page content stream. */
export function makePdf(content) {
  const stream = Buffer.from(content, "ascii");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`), stream, Buffer.from("endstream")]),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = Buffer.from("%PDF-1.4\n");
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf = Buffer.concat([pdf, Buffer.from(`${index + 1} 0 obj\n`), Buffer.isBuffer(object) ? object : Buffer.from(object), Buffer.from("\nendobj\n")]);
  });
  const xref = pdf.length;
  pdf = Buffer.concat([pdf, Buffer.from(`xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map(value => `${String(value).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`) ]);
  return pdf;
}

export const vectorPdf = makePdf("0 0 1 RG 25 25 m 275 175 l S\n");
export const blankPdf = makePdf("");
export const requirementsPdf = makePdf("BT /F1 12 Tf 20 100 Td (MAX PRESSURE 2 MPa) Tj ET\n");

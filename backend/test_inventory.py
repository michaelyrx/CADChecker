"""Regression check for the PDF content-stream inventory used by the web app."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "nx-pdf-drawing-inspection" / "scripts" / "inspect_pdf.py"


def sample_pdf(content):
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << >> >>",
        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"endstream",
    ]
    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for number, body in enumerate(objects, 1):
        offsets.append(len(pdf))
        pdf += f"{number} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(pdf)
    pdf += f"xref\n0 {len(offsets)}\n0000000000 65535 f \n".encode()
    for offset in offsets[1:]:
        pdf += f"{offset:010d} 00000 n \n".encode()
    pdf += f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return pdf


class InventoryTest(unittest.TestCase):
    def inspect(self, content):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pdf = root / "drawing.pdf"
            pdf.write_bytes(sample_pdf(content))
            manifest = root / "manifest.json"
            vectors = root / "vectors.json"
            subprocess.run([sys.executable, str(SCRIPT), str(pdf), "--output", str(manifest), "--vectors", str(vectors)], check=True, capture_output=True)
            return json.loads(manifest.read_text()), json.loads(vectors.read_text())

    def test_vector_path_is_reported(self):
        manifest, vectors = self.inspect(b"25 25 m 275 175 l S\n")
        self.assertEqual(manifest["page_count"], 1)
        self.assertEqual(vectors["pages"][0]["path_construction_count"], 2)
        self.assertEqual(vectors["pages"][0]["path_paint_count"], 1)

    def test_empty_page_has_no_vector_operations(self):
        _, vectors = self.inspect(b"")
        self.assertEqual(vectors["pages"][0]["path_paint_count"], 0)
        self.assertEqual(vectors["pages"][0]["text_operation_count"], 0)


if __name__ == "__main__":
    unittest.main()

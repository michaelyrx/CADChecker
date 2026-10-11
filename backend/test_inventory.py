"""Regression check for the PDF content-stream inventory used by the web app."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "nx-pdf-drawing-inspection" / "scripts" / "inspect_pdf.py"


def sample_pdf(content, page_options=""):
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] {page_options} /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>".encode(),
        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"endstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
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
    def inspect(self, content, page_options=""):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pdf = root / "drawing.pdf"
            pdf.write_bytes(sample_pdf(content, page_options))
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
        self.assertEqual(vectors["pages"][0]["path_regions"], [])

    def test_path_region_respects_transform_and_crop(self):
        _, vectors = self.inspect(b"q 2 0 0 2 10 20 cm 20 30 m 100 60 l S Q\n", "/CropBox [20 40 260 180]")
        page = vectors["pages"][0]
        self.assertEqual((page["display_width"], page["display_height"]), (240, 140))
        self.assertEqual(page["path_region_count"], 1)
        self.assertEqual(page["path_regions"], [{"x": 29.0, "y": 39.0, "width": 162.0, "height": 62.0}])

    def test_rotated_region_uses_display_coordinates(self):
        _, vectors = self.inspect(b"25 25 50 75 re S\n", "/Rotate 90")
        page = vectors["pages"][0]
        self.assertEqual((page["display_width"], page["display_height"]), (200, 300))
        self.assertEqual(page["path_regions"], [{"x": 24.0, "y": 24.0, "width": 77.0, "height": 52.0}])

    def test_engineering_note_text_is_saved_with_page(self):
        _, vectors = self.inspect(b"BT /F1 12 Tf 20 100 Td (MAX PRESSURE 2 MPa) Tj ET\n")
        page = vectors["pages"][0]
        self.assertEqual(page["page"], 1)
        self.assertIn("MAX PRESSURE 2 MPa", page["text_content"])
        self.assertFalse(page["text_truncated"])


if __name__ == "__main__":
    unittest.main()

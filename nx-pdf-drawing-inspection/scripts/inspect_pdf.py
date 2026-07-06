#!/usr/bin/env python3
"""Create an input manifest and a PDF content-stream vector inventory."""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pypdf import PdfReader
from pypdf.generic import ContentStream


PATH_BUILD = {b"m", b"l", b"c", b"v", b"y", b"h", b"re"}
PATH_PAINT = {b"S", b"s", b"f", b"F", b"f*", b"B", b"B*", b"b", b"b*", b"n"}
TEXT_OPS = {b"BT", b"ET", b"Tj", b"TJ", b"'", b'"', b"Tf", b"Tm", b"Td", b"TD", b"T*"}
STATE_OPS = {b"q", b"Q", b"cm", b"w", b"J", b"j", b"M", b"d", b"ri", b"i", b"gs"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def serial(value: Any) -> Any:
    if isinstance(value, bytes):
        return value.decode("latin-1", "replace")
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, (list, tuple)):
        return [serial(item) for item in value]
    try:
        return float(value)
    except (TypeError, ValueError):
        return str(value)


def box_values(box: Any) -> list[float]:
    return [float(box.left), float(box.bottom), float(box.right), float(box.top)]


def inventory_page(reader: PdfReader, page_number: int) -> dict[str, Any]:
    page = reader.pages[page_number]
    stream = ContentStream(page.get_contents(), reader)
    counts: Counter[str] = Counter()
    path_build = 0
    path_paint = 0
    text_ops = 0
    state_ops = 0
    image_draws = 0
    samples: list[dict[str, Any]] = []

    for operands, operator in stream.operations:
        name = operator.decode("latin-1", "replace")
        counts[name] += 1
        path_build += operator in PATH_BUILD
        path_paint += operator in PATH_PAINT
        text_ops += operator in TEXT_OPS
        state_ops += operator in STATE_OPS
        image_draws += operator == b"Do"
        if len(samples) < 100 and (operator in PATH_BUILD or operator in PATH_PAINT or operator in TEXT_OPS):
            samples.append({"operator": name, "operands": serial(operands)})

    resources = page.get("/Resources", {})
    xobjects = resources.get("/XObject", {}) if resources else {}
    fonts = resources.get("/Font", {}) if resources else {}

    return {
        "page": page_number + 1,
        "media_box": box_values(page.mediabox),
        "crop_box": box_values(page.cropbox),
        "rotation": int(page.get("/Rotate", 0) or 0),
        "operation_count": sum(counts.values()),
        "operator_counts": dict(sorted(counts.items())),
        "path_construction_count": path_build,
        "path_paint_count": path_paint,
        "text_operation_count": text_ops,
        "xobject_draw_count": image_draws,
        "xobject_names": [str(key) for key in xobjects.keys()],
        "font_names": [str(key) for key in fonts.keys()],
        "operation_samples": samples,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--output", type=Path, required=True, help="Manifest JSON path")
    parser.add_argument("--vectors", type=Path, required=True, help="Vector inventory JSON path")
    args = parser.parse_args()

    pdf = args.pdf.expanduser().resolve()
    reader = PdfReader(str(pdf))
    metadata = reader.metadata or {}
    manifest = {
        "schema_version": "1.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_path": str(pdf),
        "file_name": pdf.name,
        "file_size": pdf.stat().st_size,
        "sha256": sha256(pdf),
        "page_count": len(reader.pages),
        "encrypted": bool(reader.is_encrypted),
        "metadata": {str(k).lstrip("/"): serial(v) for k, v in metadata.items()},
        "pages": [
            {
                "page": index + 1,
                "media_box": box_values(page.mediabox),
                "crop_box": box_values(page.cropbox),
                "rotation": int(page.get("/Rotate", 0) or 0),
            }
            for index, page in enumerate(reader.pages)
        ],
    }
    vectors = {
        "schema_version": "1.0",
        "source_sha256": manifest["sha256"],
        "pages": [inventory_page(reader, index) for index in range(len(reader.pages))],
        "limitations": [
            "This inventory records PDF content-stream operators; semantic CAD entities require normalization.",
            "Outlined glyphs appear as paths and require visual or glyph-shape recognition.",
        ],
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.vectors.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    args.vectors.write_text(json.dumps(vectors, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"manifest": str(args.output), "vectors": str(args.vectors), "pages": len(reader.pages)}))


if __name__ == "__main__":
    main()

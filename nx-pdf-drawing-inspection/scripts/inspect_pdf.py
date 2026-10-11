#!/usr/bin/env python3
"""Create an input manifest and a PDF content-stream vector inventory."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
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
VISIBLE_PAINT = PATH_PAINT - {b"n"}


def combine_matrix(old: list[float], new: list[float]) -> list[float]:
    a, b, c, d, e, f = old
    x, y, z, w, u, v = new
    return [a * x + c * y, b * x + d * y, a * z + c * w,
            b * z + d * w, a * u + c * v + e, b * u + d * v + f]


def display_point(x: float, y: float, crop: list[float], rotation: int) -> tuple[float, float]:
    left, bottom, right, top = crop
    if rotation == 90:
        return y - bottom, x - left
    if rotation == 180:
        return right - x, y - bottom
    if rotation == 270:
        return top - y, right - x
    return x - left, top - y


def path_region(points: list[tuple[float, float]], crop: list[float], rotation: int) -> dict[str, float] | None:
    if not points or rotation not in (0, 90, 180, 270):
        return None
    transformed = [display_point(x, y, crop, rotation) for x, y in points]
    if not all(math.isfinite(value) for pair in transformed for value in pair):
        return None
    width, height = crop[2] - crop[0], crop[3] - crop[1]
    if rotation in (90, 270):
        width, height = height, width
    x0 = max(0, min(x for x, _ in transformed) - 1)
    y0 = max(0, min(y for _, y in transformed) - 1)
    x1 = min(width, max(x for x, _ in transformed) + 1)
    y1 = min(height, max(y for _, y in transformed) + 1)
    if x1 <= x0 or y1 <= y0:
        return None
    return {"x": round(x0, 2), "y": round(y0, 2), "width": round(x1 - x0, 2), "height": round(y1 - y0, 2)}


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
    crop = box_values(page.cropbox)
    rotation = int(page.get("/Rotate", 0) or 0) % 360
    page_width, page_height = crop[2] - crop[0], crop[3] - crop[1]
    if rotation in (90, 270):
        page_width, page_height = page_height, page_width
    matrix = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0]
    stack: list[list[float]] = []
    points: list[tuple[float, float]] = []
    regions: list[dict[str, float]] = []
    region_count = 0

    def add_point(x: Any, y: Any) -> None:
        try:
            px, py = float(x), float(y)
            if math.isfinite(px) and math.isfinite(py):
                a, b, c, d, e, f = matrix
                points.append((a * px + c * py + e, b * px + d * py + f))
        except (TypeError, ValueError):
            pass

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
        if operator == b"q":
            stack.append(matrix.copy())
        elif operator == b"Q":
            if stack:
                matrix = stack.pop()
        elif operator == b"cm" and len(operands) == 6:
            try:
                matrix = combine_matrix(matrix, [float(value) for value in operands])
            except (TypeError, ValueError):
                pass
        elif operator in (b"m", b"l") and len(operands) == 2:
            add_point(*operands)
        elif operator == b"c" and len(operands) == 6:
            for index in (0, 2, 4):
                add_point(operands[index], operands[index + 1])
        elif operator == b"v" and len(operands) == 4:
            for index in (0, 2):
                add_point(operands[index], operands[index + 1])
        elif operator == b"y" and len(operands) == 4:
            for index in (0, 2):
                add_point(operands[index], operands[index + 1])
        elif operator == b"re" and len(operands) == 4:
            try:
                x, y, width, height = (float(value) for value in operands)
                for px, py in ((x, y), (x + width, y), (x, y + height), (x + width, y + height)):
                    add_point(px, py)
            except (TypeError, ValueError):
                pass
        elif operator in PATH_PAINT:
            if operator in VISIBLE_PAINT:
                region = path_region(points, crop, rotation)
                if region:
                    region_count += 1
                    if len(regions) < 200:
                        regions.append(region)
            points = []

    resources = page.get("/Resources", {})
    xobjects = resources.get("/XObject", {}) if resources else {}
    fonts = resources.get("/Font", {}) if resources else {}

    return {
        "page": page_number + 1,
        "media_box": box_values(page.mediabox),
        "crop_box": box_values(page.cropbox),
        "rotation": rotation,
        "display_width": page_width,
        "display_height": page_height,
        "path_region_count": region_count,
        "path_regions": regions,
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
            "Path regions cover directly painted page-content paths only; Form XObject contents and text bounds are not localized.",
        ],
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.vectors.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    args.vectors.write_text(json.dumps(vectors, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"manifest": str(args.output), "vectors": str(args.vectors), "pages": len(reader.pages)}))


if __name__ == "__main__":
    main()

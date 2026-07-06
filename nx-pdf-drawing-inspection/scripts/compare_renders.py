#!/usr/bin/env python3
"""Create same-coordinate raster differences, component boxes, overlays, and evidence crops."""

from __future__ import annotations

import argparse
import json
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


def components(mask: np.ndarray, cell: int, radius: int, minimum: int) -> list[dict]:
    height, width = mask.shape
    pad_h, pad_w = (-height) % cell, (-width) % cell
    padded = np.pad(mask, ((0, pad_h), (0, pad_w)))
    grid = padded.reshape(padded.shape[0] // cell, cell, padded.shape[1] // cell, cell).max(axis=(1, 3))
    dilated = np.zeros_like(grid, dtype=bool)
    ys, xs = np.where(grid)
    for y, x in zip(ys, xs):
        dilated[max(0, y - radius): y + radius + 1, max(0, x - radius): x + radius + 1] = True

    seen = np.zeros_like(dilated, dtype=bool)
    found = []
    gh, gw = dilated.shape
    for start_y, start_x in zip(*np.where(dilated)):
        if seen[start_y, start_x]:
            continue
        queue = deque([(start_y, start_x)])
        seen[start_y, start_x] = True
        points = []
        while queue:
            y, x = queue.popleft()
            points.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                ny, nx = y + dy, x + dx
                if 0 <= ny < gh and 0 <= nx < gw and dilated[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    queue.append((ny, nx))
        y0 = min(y for y, _ in points) * cell
        y1 = min(height, (max(y for y, _ in points) + 1) * cell)
        x0 = min(x for _, x in points) * cell
        x1 = min(width, (max(x for _, x in points) + 1) * cell)
        count = int(mask[y0:y1, x0:x1].sum())
        if count >= minimum:
            found.append({"changed_pixels": count, "bbox": [int(x0), int(y0), int(x1), int(y1)]})
    found.sort(key=lambda item: item["changed_pixels"], reverse=True)
    for index, item in enumerate(found, 1):
        item["candidate_id"] = f"DIFF-{index:04d}"
    return found


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("baseline", type=Path)
    parser.add_argument("test", type=Path)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--threshold", type=int, default=25)
    parser.add_argument("--cell", type=int, default=20)
    parser.add_argument("--group-radius", type=int, default=4)
    parser.add_argument("--minimum-pixels", type=int, default=20)
    args = parser.parse_args()

    base_image = Image.open(args.baseline).convert("RGB")
    test_image = Image.open(args.test).convert("RGB")
    if base_image.size != test_image.size:
        raise SystemExit(f"Image sizes differ: {base_image.size} vs {test_image.size}; normalize before comparison")
    base = np.asarray(base_image)
    test = np.asarray(test_image)
    base_gray = np.asarray(base_image.convert("L"))
    test_gray = np.asarray(test_image.convert("L"))
    delta = np.abs(base_gray.astype(np.int16) - test_gray.astype(np.int16))
    mask = delta > args.threshold
    found = components(mask, args.cell, args.group_radius, args.minimum_pixels)

    common = np.minimum(base_gray, test_gray)
    overlay = np.stack([common, common, common], axis=2)
    base_ink = base_gray < 220
    test_ink = test_gray < 220
    overlay[base_ink & ~test_ink] = [255, 0, 0]
    overlay[test_ink & ~base_ink] = [0, 120, 255]
    output_image = Image.fromarray(overlay.astype(np.uint8))
    draw = ImageDraw.Draw(output_image)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    width, height = base_image.size
    for item in found:
        x0, y0, x1, y1 = item["bbox"]
        draw.rectangle((x0, y0, x1, y1), outline=(255, 0, 255), width=5)
        draw.text((x0 + 5, y0 + 5), item["candidate_id"], fill=(180, 0, 180))
        pad = 60
        crop_box = (max(0, x0 - pad), max(0, y0 - pad), min(width, x1 + pad), min(height, y1 + pad))
        left = base_image.crop(crop_box)
        right = test_image.crop(crop_box)
        canvas = Image.new("RGB", (left.width * 2, left.height + 40), "white")
        canvas.paste(left, (0, 40))
        canvas.paste(right, (left.width, 40))
        label = ImageDraw.Draw(canvas)
        label.text((10, 10), f"BASE {item['candidate_id']}", fill="red")
        label.text((left.width + 10, 10), f"TEST {item['candidate_id']}", fill="blue")
        evidence_file = f"{item['candidate_id']}_side_by_side.png"
        canvas.save(args.output_dir / evidence_file)
        item["evidence_file"] = evidence_file

    output_image.save(args.output_dir / "difference_overlay.png")
    result = {
        "schema_version": "1.0",
        "baseline": str(args.baseline.resolve()),
        "test": str(args.test.resolve()),
        "image_size": [width, height],
        "threshold": args.threshold,
        "changed_pixels": int(mask.sum()),
        "changed_ratio": float(mask.mean()),
        "candidate_count": len(found),
        "candidates": found,
        "warning": "Candidates are visual differences, not semantic CAD findings; complete feature matching and rule inspection.",
    }
    (args.output_dir / "difference_candidates.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({"candidate_count": len(found), "changed_pixels": int(mask.sum()), "output_dir": str(args.output_dir)}))


if __name__ == "__main__":
    main()

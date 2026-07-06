#!/usr/bin/env python3
"""Render PDF pages with Poppler while recording deterministic render metadata."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from pathlib import Path

from PIL import Image


def find_pdftoppm() -> str:
    direct = shutil.which("pdftoppm")
    if direct:
        return direct
    root = Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/bin/pdftoppm"
    if root.exists():
        return str(root)
    candidates = sorted((Path.home() / ".cache/codex-runtimes").glob("**/dependencies/bin/pdftoppm"))
    if candidates:
        return str(candidates[-1])
    raise SystemExit("pdftoppm not found; load the bundled workspace dependencies or install Poppler")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--dpi", type=int, default=300)
    parser.add_argument("--prefix", default="page")
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    prefix = args.output_dir / args.prefix
    command = [find_pdftoppm(), "-r", str(args.dpi), "-png", str(args.pdf.resolve()), str(prefix)]
    subprocess.run(command, check=True)
    images = sorted(args.output_dir.glob(f"{args.prefix}-*.png"))
    records = []
    for index, path in enumerate(images, 1):
        with Image.open(path) as image:
            records.append({"page": index, "file": path.name, "width": image.width, "height": image.height, "dpi": args.dpi})
    metadata = {"schema_version": "1.0", "source": str(args.pdf.resolve()), "renderer": command[0], "pages": records}
    (args.output_dir / "render_manifest.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(json.dumps({"output_dir": str(args.output_dir), "page_count": len(records), "dpi": args.dpi}))


if __name__ == "__main__":
    main()

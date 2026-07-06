"""Shared deterministic helpers for dataset, ruleset, and audit management."""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$")
VERSION_RE = re.compile(r"^\d+\.\d+\.\d+$")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_json(path: Path, default: Any = None) -> Any:
    if not path.exists():
        if default is not None:
            return default
        raise SystemExit(f"Missing JSON file: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_json(value: Any) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def require_id(value: str, label: str = "id") -> str:
    if not ID_RE.fullmatch(value):
        raise SystemExit(f"Invalid {label}: {value}; use lower-case letters, digits, and hyphens")
    return value


def require_version(value: str) -> str:
    if not VERSION_RE.fullmatch(value):
        raise SystemExit(f"Invalid semantic version: {value}")
    return value


def relative_to(path: Path, root: Path) -> str:
    try:
        return str(path.resolve().relative_to(root.resolve()))
    except ValueError:
        return str(path.resolve())

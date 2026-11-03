#!/usr/bin/env python3
"""Build a distributable .wox package for Wox 2.

A .wox file is a ZIP archive with plugin.json at its root. Entry names always use
forward slashes so the package extracts correctly on windows, linux and darwin.

Usage:  python build.py
Output: dist/MultiTranslate-for-Wox-<version>.wox  (version from plugin.json)
"""
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"

# Files/dirs shipped in the package; tests are included so users can verify the build.
INCLUDE_FILES = ["plugin.json", "index.js", "google-base.js", "README.md", "LICENSE", "test.js", "test-live.js"]
INCLUDE_DIRS = ["assets"]
EXCLUDE_SUFFIXES = {".wox"}
EXCLUDE_NAMES = {"build.py", ".DS_Store", "Thumbs.db"}


def collect():
    files = []
    for name in INCLUDE_FILES:
        p = ROOT / name
        if not p.exists():
            sys.exit(f"missing required file: {name}")
        files.append(p)
    for d in INCLUDE_DIRS:
        base = ROOT / d
        if not base.is_dir():
            sys.exit(f"missing required directory: {d}")
        files.extend(p for p in sorted(base.rglob("*")) if p.is_file())
    return files


def build():
    manifest = json.loads((ROOT / "plugin.json").read_text(encoding="utf-8"))
    version = manifest["Version"]
    out = DIST / f"MultiTranslate-for-Wox-{version}.wox"
    DIST.mkdir(exist_ok=True)

    files = [p for p in collect()
             if p.suffix.lower() not in EXCLUDE_SUFFIXES
             and p.name not in EXCLUDE_NAMES
             and DIST not in p.parents]

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p in files:
            z.write(p, p.relative_to(ROOT).as_posix())

    # Validate the package before declaring success.
    with zipfile.ZipFile(out) as z:
        bad = z.testzip()
        assert bad is None, f"corrupt entry: {bad}"
        names = z.namelist()
        assert "plugin.json" in names, "plugin.json must be at the package root"
        manifest_pkg = json.loads(z.read("plugin.json"))
        assert manifest_pkg["Version"] == version
        assert manifest_pkg["Entry"] in names, "entry file missing from package"
        assert any(n == "assets/icon.png" for n in names), "plugin icon missing"
        icons = [n for n in names if n.startswith("assets/service_icon/")]
        entry_names = {n.split("/", 1)[0] for n in names}
        print(f"package : {out}")
        print(f"version : {manifest_pkg['Version']}")
        print(f"files   : {len(names)} ({len(icons)} service icons)")
        print(f"top level: {sorted(entry_names)}")
        print(f"size    : {out.stat().st_size / 1024:.1f} KiB")
    print("package OK")


if __name__ == "__main__":
    build()

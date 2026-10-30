#!/usr/bin/env python3
"""Fetch and verify the locally bundled Open Animal Stage brain packages.

Datasets and generated package files stay under ignored web/species/. The
catalogue and this reproducible fetch/export path are the code that is pushed.
"""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://html-classic.itch.zone/html/19345381-2002452/"
OAS_COMMIT = "4cb2c8610c801febf355279e58a920897ce99e3e"
OAS_REPO = "https://github.com/Pr1nted/Open-Animal-Stage.git"


def fetch(url, dst):
    dst = Path(dst)
    if dst.exists() and dst.stat().st_size:
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_suffix(dst.suffix + ".part-download")
    req = urllib.request.Request(url, headers={"User-Agent": "Open-Fly-local-build/1"})
    print("fetch", url, flush=True)
    with urllib.request.urlopen(req, timeout=300) as src, tmp.open("wb") as out:
        shutil.copyfileobj(src, out, 1 << 20)
    if not tmp.stat().st_size:
        raise RuntimeError(f"empty response: {url}")
    tmp.replace(dst)


def sha(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def fetch_packed(sid, name):
    folder = ROOT / "web" / "species" / sid
    manifest_path = folder / f"{name}.pack.json"
    fetch(BASE + f"species/{sid}/{name}.pack.json", manifest_path)
    manifest = json.loads(manifest_path.read_text())
    for part in manifest["parts"]:
        fetch(BASE + f"species/{sid}/{part}", folder / part)
    joined = hashlib.sha256()
    size = 0
    for part in manifest["parts"]:
        with (folder / part).open("rb") as f:
            for block in iter(lambda: f.read(1 << 20), b""):
                joined.update(block)
                size += len(block)
    if size != manifest["compressed"] or joined.hexdigest() != manifest["sha256"]:
        raise RuntimeError(f"{sid}/{name}: packed parts fail manifest size/SHA-256")
    print(f"verified {sid}/{name}: {size:,} bytes, {len(manifest['parts'])} parts")


def fetch_remote_packages():
    for sid in ("drosophila_female", "drosophila_male", "ciona_larva", "zebrafish_larva"):
        folder = ROOT / "web" / "species" / sid
        fetch(BASE + f"species/{sid}/brain.json", folder / "brain.json")
        if sid in ("drosophila_female", "drosophila_male"):
            fetch_packed(sid, "connectome")
        else:
            fetch(BASE + f"species/{sid}/connectome.bin", folder / "connectome.bin")
    fetch(BASE + "species/drosophila_female/positions.bin", ROOT / "web/species/drosophila_female/positions.bin")
    folder = ROOT / "web" / "species" / "mouse_v1"
    fetch(BASE + "species/mouse_v1/mouse.json", folder / "mouse.json")
    fetch_packed("mouse_v1", "model")


def local_species(py):
    cache = ROOT / ".cache" / "open-animal-stage"
    if not (cache / ".git").exists():
        cache.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "clone", "--filter=blob:none", OAS_REPO, str(cache)], check=True)
    subprocess.run(["git", "-C", str(cache), "fetch", "--depth", "1", "origin", OAS_COMMIT], check=True)
    subprocess.run(["git", "-C", str(cache), "checkout", "--detach", OAS_COMMIT], check=True)
    tools = cache / "tools"
    subprocess.run([py, str(tools / "export_larva.py"), "--unsigned", "sensory-cholinergic"], cwd=cache, check=True)
    subprocess.run([py, str(tools / "export_celegans.py"), "--no-roster"], cwd=cache, check=True)
    for sid in ("drosophila_larva", "c_elegans_herm", "c_elegans_male"):
        src, dst = cache / "web" / "species" / sid, ROOT / "web" / "species" / sid
        if not (src / "brain.json").is_file() or not (src / "connectome.bin").is_file():
            raise RuntimeError(f"source exporter did not produce a complete package: {src}")
        dst.mkdir(parents=True, exist_ok=True)
        for f in src.iterdir():
            if f.is_file(): shutil.copy2(f, dst / f.name)


def verify(sid):
    folder = ROOT / "web" / "species" / sid
    meta = folder / "brain.json"
    if sid == "mouse_v1":
        meta = folder / "mouse.json"
    if not meta.is_file(): raise RuntimeError(f"{sid}: missing {meta}")
    if sid != "mouse_v1":
        manifest_path = folder / "connectome.pack.json"
        if not manifest_path.exists():
            raw = folder / "connectome.bin"
            if not raw.exists(): raise RuntimeError(f"{sid}: missing connectome")
            subprocess.run([sys.executable, str(ROOT / "tools/pack_web.py"), "--no-gzip", str(raw)], check=True)
        m = json.loads(manifest_path.read_text())
    else:
        m = json.loads((folder / "model.pack.json").read_text())
    for part in m["parts"]:
        if not (folder / part).is_file(): raise RuntimeError(f"{sid}: missing {part}")
    expected = m["sha256"]
    h, n = hashlib.sha256(), 0
    for part in m["parts"]:
        with (folder / part).open("rb") as f:
            for block in iter(lambda: f.read(1 << 20), b""):
                h.update(block); n += len(block)
    if h.hexdigest() != expected or n != m["compressed"]:
        raise RuntimeError(f"{sid}: package parts do not match the catalog manifest")
    print(f"ready {sid}: {meta.stat().st_size:,} metadata bytes; {n:,} verified data bytes")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--python", default=sys.executable, help="Python with Open Animal Stage exporter dependencies")
    args = ap.parse_args()
    fetch_remote_packages()
    local_species(args.python)
    for sid in ("drosophila_female", "drosophila_male", "drosophila_larva", "c_elegans_herm", "c_elegans_male", "ciona_larva", "zebrafish_larva", "mouse_v1"):
        verify(sid)


if __name__ == "__main__":
    main()

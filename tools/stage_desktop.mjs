#!/usr/bin/env node
// Stage the browser app for Tauri, omitting originals represented by packed
// part files so the large connectome and game data are not bundled twice.
import { cp, mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const web = path.join(root, "web");
const out = path.join(root, "dist", "desktop-web");
const manifests = [];
const packedOriginals = new Set();
const files = [];

async function exists(file) {
  try { await stat(file); return true; } catch { return false; }
}

async function verifyManifest(file) {
  const manifest = JSON.parse(await readFile(file, "utf8"));
  if (manifest.gzip) throw new Error(`${path.relative(root, file)} must contain plain parts for offline desktop packaging`);
  const hash = createHash("sha256");
  let size = 0;
  for (const part of manifest.parts || []) {
    const full = path.join(path.dirname(file), part);
    if (!await exists(full)) throw new Error(`${path.relative(root, file)} names missing part ${part}`);
    for await (const chunk of createReadStream(full)) { hash.update(chunk); size += chunk.length; }
  }
  if (size !== manifest.size || size !== manifest.compressed || hash.digest("hex") !== manifest.sha256)
    throw new Error(`${path.relative(root, file)} parts fail size/SHA-256 verification`);
  packedOriginals.add(path.resolve(path.dirname(file), manifest.name));
  manifests.push({ file, parts: manifest.parts });
}

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (dir === web && entry.name === "data") continue;
      await walk(full);
    }
    else if (entry.isFile()) files.push(full);
  }
}

await walk(web);
for (const file of files.filter((name) => name.endsWith(".pack.json"))) await verifyManifest(file);

const roster = JSON.parse(await readFile(path.join(web, "roster.json"), "utf8"));
for (const species of roster.species) {
  if (!species.seat && !species.station) continue;
  const resources = species.resources || {};
  for (const [key, rel] of Object.entries(resources)) {
    if (typeof rel !== "string") continue;
    const full = path.join(web, rel);
    if (!await exists(full) || (await stat(full)).size === 0) throw new Error(`catalogue ${species.id}.${key} is missing or empty: ${rel}`);
    if (key === "metadata") {
      const meta = JSON.parse(await readFile(full, "utf8"));
      if (!Number.isInteger(meta.n) || meta.n < 1) throw new Error(`${species.id}: invalid neuron count in ${rel}`);
    }
    if (key === "model") {
      const glb = await readFile(full);
      if (glb.toString("ascii", 0, 4) !== "glTF") throw new Error(`${species.id}: ${rel} is not a GLB model`);
    }
  }
  const metadata = resources.metadata;
  if (!metadata) throw new Error(`catalogue ${species.id} has no metadata resource`);
  const base = path.join(web, metadata);
  if (!await exists(base)) throw new Error(`${species.id}: missing metadata ${metadata}`);
  if (species.id === "mouse_v1") {
    if (!await exists(path.join(web, resources.modelWeights || ""))) throw new Error("mouse model weights are missing");
  } else if (!await exists(path.join(web, resources.connectome || ""))) {
    throw new Error(`${species.id}: connectome package is missing`);
  }
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
let copied = 0;
let bytes = 0;
for (const src of files) {
  if (path.basename(src) === "README.md" || path.basename(src) === ".DS_Store" || packedOriginals.has(src)) continue;
  const dst = path.join(out, path.relative(web, src));
  await mkdir(path.dirname(dst), { recursive: true });
  await cp(src, dst);
  copied++;
  bytes += (await stat(src)).size;
}
console.log(`staged ${copied} files (${(bytes / 1e6).toFixed(1)} MB) into ${path.relative(root, out)}`);

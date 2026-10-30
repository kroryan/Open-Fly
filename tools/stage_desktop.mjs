#!/usr/bin/env node
// Stage the browser app for Tauri, omitting originals represented by packed
// part files so the large connectome and game data are not bundled twice.
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const web = path.join(root, "web");
const out = path.join(root, "dist", "desktop-web");
const profile = process.env.OPEN_FLY_BUILD_PROFILE || "private";
const brainRootPrefix = process.env.OPEN_FLY_BRAIN_ROOT ? process.env.OPEN_FLY_BRAIN_ROOT.replace(/\/?$/, "/") : null;
if (!["private", "public"].includes(profile)) throw new Error(`unknown OPEN_FLY_BUILD_PROFILE: ${profile}`);
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

const publicSpecies = new Set(roster.species.filter((species) => species.public_redistribute === true).map((species) => species.id));
const brainFiles = files.filter((file) => {
  const parts = path.relative(web, file).split(path.sep);
  return parts[0] === "species" && path.basename(file) !== "README.md" && !packedOriginals.has(path.resolve(file))
    && (profile !== "public" || publicSpecies.has(parts[1]));
});
const inventory = { version: 1, files: [] };
for (const file of brainFiles) {
  const hash = createHash("sha256");
  let size = 0;
  for await (const chunk of createReadStream(file)) { hash.update(chunk); size += chunk.length; }
  inventory.files.push({ path: path.relative(web, file).split(path.sep).join("/"), size, sha256: hash.digest("hex") });
}
inventory.revision = createHash("sha256").update(JSON.stringify(inventory.files)).digest("hex").slice(0, 16);
inventory.termsRevision = createHash("sha256").update(JSON.stringify(roster.species.map(({ id, dataset, licence, license, public_redistribute, public_why, redistribute_why, terms_url }) => ({ id, dataset, licence, license, public_redistribute, public_why, redistribute_why, terms_url })))).digest("hex").slice(0, 16);
const brainRoot = brainRootPrefix ? `${brainRootPrefix}${inventory.revision}/` : null;

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
let copied = 0;
let bytes = 0;
for (const src of files) {
  if (path.basename(src) === "README.md" || path.basename(src) === ".DS_Store" || packedOriginals.has(src)) continue;
  const rel = path.relative(web, src).split(path.sep).join("/");
  if (profile === "public" && rel.startsWith("species/") && !publicSpecies.has(rel.split("/")[1])) continue;
  if (profile === "public" && rel.startsWith("data/")) continue;
  if (profile === "public" && (rel === "mouse-worker.js" || rel.startsWith("vendor/onnxruntime-web/"))) continue;
  if (rel === "roster.json") continue;
  const dst = path.join(out, path.relative(web, src));
  await mkdir(path.dirname(dst), { recursive: true });
  await cp(src, dst);
  copied++;
  bytes += (await stat(src)).size;
}
if (profile === "public") for (const species of roster.species) {
  if (!publicSpecies.has(species.id)) species.public_disabled = true;
}
roster.delivery = profile === "public"
  ? { profile, ...(brainRoot ? { brainRoot } : {}), cacheVersion: inventory.revision, termsVersion: inventory.termsRevision }
  : { profile };
await writeFile(path.join(out, "roster.json"), `${JSON.stringify(roster, null, 2)}\n`);
if (profile === "public") {
  await writeFile(path.join(out, "brain-inventory.json"), `${JSON.stringify(inventory)}\n`);
  const host = path.join(root, "dist", "brain-host", inventory.revision);
  await rm(host, { recursive: true, force: true });
  await mkdir(host, { recursive: true });
  await writeFile(path.join(host, "brain-inventory.json"), `${JSON.stringify(inventory)}\n`);
  for (const src of brainFiles) {
    const dst = path.join(host, path.relative(web, src));
    await mkdir(path.dirname(dst), { recursive: true });
    await cp(src, dst);
  }
  console.log(`prepared ${brainFiles.length} public brain files in ${path.relative(root, host)} (${(inventory.files.reduce((n, f) => n + f.size, 0) / 1e6).toFixed(1)} MB)`);
}
console.log(`staged ${copied} files (${(bytes / 1e6).toFixed(1)} MB) into ${path.relative(root, out)}`);

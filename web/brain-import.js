import { removeImportedBrainSpecies, storeImportedBrainFiles } from "./brain-cache.js";

const tailOf = (path) => String(path || "").split("/").slice(2).join("/");
const basename = (path) => String(path || "").split("/").at(-1);

function importedPath(file, speciesIds) {
  const pieces = (file.webkitRelativePath || file.name).replaceAll("\\", "/").split("/").filter(Boolean);
  const speciesAt = pieces.lastIndexOf("species");
  if (speciesAt >= 0 && speciesIds.has(pieces[speciesAt + 1]) && pieces.length > speciesAt + 2) {
    const id = pieces[speciesAt + 1];
    return { id, path: `species/${id}/${pieces.slice(speciesAt + 2).join("/")}`, file };
  }
  const idAt = pieces.findIndex((part) => speciesIds.has(part));
  if (idAt >= 0 && pieces.length > idAt + 1) {
    const id = pieces[idAt];
    return { id, path: `species/${id}/${pieces.slice(idAt + 1).join("/")}`, file };
  }
  return null;
}

async function completePackage(species, files) {
  const byPath = new Map(files.map((entry) => [entry.path.slice(`species/${species.id}/`.length), entry]));
  const metadataPath = tailOf(species.resources?.metadata);
  const metadataEntry = byPath.get(metadataPath);
  if (!metadataEntry) return { error: `missing ${basename(metadataPath)}` };
  let metadata;
  try { metadata = JSON.parse(await metadataEntry.file.text()); }
  catch { return { error: `${basename(metadataPath)} is not valid JSON` }; }
  if (!Number.isInteger(metadata.n) || metadata.n < 1) return { error: `${basename(metadataPath)} has no valid neuron count` };

  const manifestPath = tailOf(species.resources?.connectome);
  if (!manifestPath) return { error: "the catalogue has no data package path" };
  const manifestFile = byPath.get(manifestPath);
  if (manifestFile) {
    let manifest;
    try { manifest = JSON.parse(await manifestFile.file.text()); }
    catch { return { error: `${basename(manifestPath)} is not valid JSON` }; }
    if (!Array.isArray(manifest.parts) || !manifest.parts.length || !manifest.parts.every((part) => typeof part === "string"))
      return { error: `${basename(manifestPath)} does not list its data files` };
    const folder = manifestPath.includes("/") ? manifestPath.slice(0, manifestPath.lastIndexOf("/") + 1) : "";
    const missing = manifest.parts.filter((part) => !byPath.has(`${folder}${part}`));
    if (missing.length) return { error: `missing ${missing.length} data part${missing.length === 1 ? "" : "s"} (first: ${missing[0]})` };
  } else {
    const rawFolder = manifestPath.includes("/") ? manifestPath.slice(0, manifestPath.lastIndexOf("/") + 1) : "";
    if (!byPath.has(`${rawFolder}connectome.bin`)) return { error: `include ${basename(manifestPath)} and all its parts, or connectome.bin` };
  }
  return { files };
}

export async function importBrainFolder(fileList, roster, onProgress = () => {}) {
  const speciesById = new Map(roster.map((species) => [species.id, species]));
  const speciesIds = new Set(speciesById.keys());
  const parsed = [...fileList].map((file) => importedPath(file, speciesIds)).filter(Boolean);
  const grouped = new Map();
  for (const entry of parsed) {
    if (!grouped.has(entry.id)) grouped.set(entry.id, []);
    grouped.get(entry.id).push(entry);
  }

  const ready = [], skipped = [];
  for (const [id, files] of grouped) {
    const result = await completePackage(speciesById.get(id), files);
    if (result.error) skipped.push(`${speciesById.get(id).name} (${speciesById.get(id).detail}): ${result.error}`);
    else ready.push({ id, name: `${speciesById.get(id).name} · ${speciesById.get(id).detail}`, files: result.files });
  }
  if (!ready.length) {
    const reason = skipped.length ? skipped.join("; ") : "no known species folder was found";
    throw new Error(`No complete brain package was found: ${reason}. Select web/species or one species folder from it.`);
  }

  for (const packageEntry of ready) await removeImportedBrainSpecies(packageEntry.id);
  const entries = ready.flatMap((item) => item.files);
  try {
    await storeImportedBrainFiles(entries, onProgress);
  } catch (error) {
    for (const item of ready) await removeImportedBrainSpecies(item.id);
    throw error;
  }
  return { imported: ready.map(({ id, name }) => ({ id, name })), skipped };
}

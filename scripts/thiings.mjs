#!/usr/bin/env node

import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const CATALOG_URL = "https://www.thiings.co/api/catalog";
const IMAGE_ROOT = "https://lftz25oez4aqbxpq.public.blob.vercel-storage.com";
const SITE_ROOT = "https://www.thiings.co/things";
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 12;

function usage(exitCode = 0) {
  const stream = exitCode === 0 ? process.stdout : process.stderr;
  stream.write(`Usage:
  thiings.mjs search <query> [--limit N] [--json] [--refresh]
  thiings.mjs info <slug> [--json] [--refresh]
  thiings.mjs download <slug> <destination> [--force] [--refresh]

Examples:
  thiings.mjs search "coffee cup" --limit 8
  thiings.mjs info rocket
  thiings.mjs download rocket ./public/images/rocket.png
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const positionals = [];
  const options = { force: false, json: false, refresh: false, limit: DEFAULT_LIMIT };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--force") options.force = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--refresh") options.refresh = true;
    else if (arg === "--limit") {
      const rawLimit = argv[index + 1];
      if (!rawLimit) throw new Error("--limit needs a number");
      options.limit = Number.parseInt(rawLimit, 10);
      index += 1;
    } else if (arg === "--help" || arg === "-h") usage();
    else if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
    else positionals.push(arg);
  }

  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 100) {
    throw new Error("--limit must be an integer from 1 to 100");
  }

  return { positionals, options };
}

function cachePath() {
  const base = process.env.THIINGS_CACHE_DIR
    ? path.resolve(process.env.THIINGS_CACHE_DIR)
    : process.platform === "darwin"
      ? path.join(os.homedir(), "Library", "Caches", "thiings-skill")
      : path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"), "thiings-skill");
  return path.join(base, "catalog.json");
}

async function readFreshCache(file) {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8"));
    if (!parsed.cachedAt || Date.now() - parsed.cachedAt > CACHE_MAX_AGE_MS) return null;
    return parsed.catalog;
  } catch {
    return null;
  }
}

function validateCatalog(catalog) {
  if (
    !catalog ||
    !Array.isArray(catalog.categories) ||
    !Array.isArray(catalog.items) ||
    catalog.items.length === 0
  ) {
    throw new Error("Thiings returned an invalid catalog");
  }
  return catalog;
}

async function fetchCatalog() {
  const response = await fetch(CATALOG_URL, {
    headers: { accept: "application/json", "user-agent": "thiings-skill/1.0" },
  });
  if (!response.ok) throw new Error(`Catalog request failed with HTTP ${response.status}`);
  return validateCatalog(await response.json());
}

async function loadCatalog(refresh) {
  const file = cachePath();
  if (!refresh) {
    const cached = await readFreshCache(file);
    if (cached) return validateCatalog(cached);
  }

  const catalog = await fetchCatalog();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ cachedAt: Date.now(), catalog }), "utf8");
  return catalog;
}

function expandCatalog(catalog) {
  return catalog.items.map((row) => {
    const [slug, fileId, name, categoryIndexes, latest] = row;
    return {
      slug,
      name,
      categories: categoryIndexes.map((index) => catalog.categories[index]).filter(Boolean),
      latest: latest === 1,
      imageUrl: `${IMAGE_ROOT}/image-${fileId}.png`,
      sourceUrl: `${SITE_ROOT}/${slug}`,
    };
  });
}

function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreItem(item, rawQuery) {
  const query = normalize(rawQuery);
  const words = query.split(/\s+/).filter(Boolean);
  const name = normalize(item.name);
  const slug = normalize(item.slug);
  const categories = item.categories.map(normalize);
  let score = 0;

  if (name === query) score += 1_000;
  if (slug === query) score += 950;
  if (name.startsWith(query)) score += 400;
  if (slug.startsWith(query)) score += 350;
  if (name.includes(query)) score += 300;
  if (slug.includes(query)) score += 250;
  if (categories.includes(query)) score += 225;

  for (const word of words) {
    if (name.split(" ").includes(word)) score += 100;
    else if (name.includes(word)) score += 60;
    if (slug.split(" ").includes(word)) score += 80;
    if (categories.some((category) => category === word)) score += 70;
    else if (categories.some((category) => category.includes(word))) score += 30;
  }

  const searchable = [name, slug, ...categories].join(" ");
  if (!words.every((word) => searchable.includes(word))) return 0;
  return score + (item.latest ? 2 : 0);
}

function search(items, query, limit) {
  return items
    .map((item) => ({ item, score: scoreItem(item, query) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.item.name.localeCompare(right.item.name))
    .slice(0, limit)
    .map(({ item }) => item);
}

function printItem(item) {
  process.stdout.write(`${item.name}\n`);
  process.stdout.write(`  slug: ${item.slug}\n`);
  process.stdout.write(`  categories: ${item.categories.join(", ")}\n`);
  process.stdout.write(`  image: ${item.imageUrl}\n`);
  process.stdout.write(`  source: ${item.sourceUrl}\n`);
}

async function pathExists(file) {
  try {
    await access(file, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function download(item, destination, force) {
  const output = path.resolve(destination);
  const outputExists = await pathExists(output);
  if (outputExists && !force) {
    throw new Error(`${output} already exists. Pass --force to replace it.`);
  }

  const response = await fetch(item.imageUrl, { headers: { "user-agent": "thiings-skill/1.0" } });
  if (!response.ok) throw new Error(`Image download failed with HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!pngSignature.every((byte, index) => bytes[index] === byte)) {
    throw new Error("The downloaded asset is not a PNG");
  }

  await mkdir(path.dirname(output), { recursive: true });
  const temporary = `${output}.tmp-${process.pid}`;
  try {
    await writeFile(temporary, bytes);
    if (outputExists && process.platform === "win32") await rm(output);
    await rename(temporary, output);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }

  process.stdout.write(`Downloaded ${item.name} to ${output}\n`);
  process.stdout.write(`Source: ${item.sourceUrl}\n`);
  process.stdout.write("License: Free use is personal and non-commercial with visible thiings.co attribution. Check https://www.thiings.co/terms for paid use.\n");
}

async function main() {
  const { positionals, options } = parseArgs(process.argv.slice(2));
  const [command, ...args] = positionals;
  if (!command) usage(1);

  const catalog = await loadCatalog(options.refresh);
  const items = expandCatalog(catalog);

  if (command === "search") {
    const query = args.join(" ").trim();
    if (!query) throw new Error("search needs a query");
    const results = search(items, query, options.limit);
    if (options.json) process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
    else if (results.length === 0) process.stdout.write(`No Thiings found for "${query}".\n`);
    else results.forEach((item, index) => {
      if (index > 0) process.stdout.write("\n");
      printItem(item);
    });
    return;
  }

  if (command === "info") {
    if (args.length !== 1) throw new Error("info needs one slug");
    const item = items.find((candidate) => candidate.slug === args[0]);
    if (!item) throw new Error(`No Thiing has the slug "${args[0]}"`);
    if (options.json) process.stdout.write(`${JSON.stringify(item, null, 2)}\n`);
    else printItem(item);
    return;
  }

  if (command === "download") {
    if (args.length !== 2) throw new Error("download needs a slug and destination path");
    const item = items.find((candidate) => candidate.slug === args[0]);
    if (!item) throw new Error(`No Thiing has the slug "${args[0]}"`);
    await download(item, args[1], options.force);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  process.stderr.write(`Error: ${error.message}\n`);
  process.exit(1);
});

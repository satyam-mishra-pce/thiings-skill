---
name: thiings
description: Search Thiings.co for 3D PNG graphics, inspect candidates, download the original asset, and add it to a project. Use when a user asks for a 3D icon, object graphic, Thiing, Thiings.co asset, playful product illustration, or wants to search or use graphics from the Thiings collection.
---

# Thiings

Use graphics from the public Thiings.co collection without browsing the grid by hand.

## Search and download

The helper has no package dependencies and needs Node.js 18 or newer.

```bash
node <skill-dir>/scripts/thiings.mjs search "rocket" --limit 12
node <skill-dir>/scripts/thiings.mjs search "coffee cup" --json
node <skill-dir>/scripts/thiings.mjs info rocket
node <skill-dir>/scripts/thiings.mjs download rocket ./public/images/rocket.png
```

Replace `<skill-dir>` with the directory containing this file. Search results include the slug, categories, source page, and original PNG URL. Search accepts names, slugs, and categories.

For visual comparison, inspect the `imageUrl` values returned by `search --json`, or open several source pages. Do not choose only from the name when the project's composition, lighting, or color palette matters.

## Workflow

1. Read the project's layout and asset conventions before downloading anything.
2. Search with concrete nouns first. Try a synonym or category if the first query is weak.
3. Compare a few candidates visually.
4. Check the license rules below before using an asset.
5. Download the original PNG into the project's existing image or public-assets directory. Use a descriptive lowercase filename.
6. Integrate the local file. Do not hotlink the Thiings CDN in shipped code.
7. Preserve the image's aspect ratio. Supply useful alt text when the image conveys content. Use empty alt text when it is decoration.
8. Run the project's checks and inspect the result at relevant viewport sizes.

## License check

Thiings' current terms distinguish free and paid use. Check [thiings.co/terms](https://www.thiings.co/terms) when licensing affects the work because the terms can change.

- Free individual downloads are for personal, non-commercial use and require visible attribution to `thiings.co`.
- Commercial projects require the appropriate paid license.
- No tier permits reselling or redistributing icons as standalone assets or as a competing asset collection.
- A client's revenue determines the needed tier for client work.

If the intended use is unclear, ask whether the project is commercial and whether the user has a suitable Thiings license. Do not claim that a free download grants commercial rights. Attribution must be visible in the finished project, not hidden only in source code.

## Helper behavior

The helper reads Thiings' public catalog and caches it for 24 hours in the user's cache directory. Set `THIINGS_CACHE_DIR` to change the cache location. Use `--refresh` to fetch the catalog again.

```bash
node <skill-dir>/scripts/thiings.mjs search "animal" --refresh
```

If the helper stops working because Thiings changed its catalog or asset host, use the website directly and update the helper rather than scraping unrelated pages or bypassing access controls.

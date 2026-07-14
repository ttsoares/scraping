<!-- OPENWIKI:START -->

## OpenWiki

This repository uses OpenWiki for recurring code documentation. Start with `openwiki/quickstart.md`, then follow its links to architecture, workflows, domain concepts, operations, integrations, testing guidance, and source maps.

The scheduled OpenWiki GitHub Actions workflow refreshes the repository wiki. Do not hand-edit generated OpenWiki pages unless explicitly asked; prefer updating source code/docs and letting OpenWiki regenerate.

<!-- OPENWIKI:END -->

## Product Intelligence Notes

- Runtime product intelligence path: `SearchService.search()` normalizes provider results, extracts `canonicalProducts` with `StorageDeviceExtractor`, and can compare them via `ComparisonEngine` when `options.compareAgainst` is supplied.
- `ProductMatch.matchProducts()` is a backward-compatible facade over `src/comparison/ComparisonEngine.js`.
- `npm test` is currently a placeholder failure; run direct Node tests such as `node tests/StorageDeviceExtractor.test.js`, `node tests/ProductMatch.test.js`, `node tests/comparison-engine.test.js`, and `node tests/product-intelligence-pipeline.test.js`.


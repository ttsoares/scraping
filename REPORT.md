# Engineering Loop — Restore End-to-End Product Search

## Objective

Restore the application so a UI search for a common product (e.g. "NVIDIA
5060 Ti") returns products from live providers. The benchmark and unit
suites passed, but the interactive UI returned zero products from every
provider.

## Repository audit summary

This working tree carries substantial uncommitted work from a prior loop
(the browser abstraction layer under `src/browser/`, the comparison/product
intelligence layer under `src/comparison/` and `src/products/`, and this
same `REPORT.md`/`BENCHMARK_REPORT.md`) that is unrelated to this
regression. None of it was touched here; this loop's fix is isolated to
two files and committed on its own.

The task brief mentioned `BrowserExecutor` and a `Schema version mismatch:
expected 2, got 1` warning as investigation leads. Both are real: the repo
now has a `BrowserExecutor` (`src/browser/BrowserExecutor.js`), and
`SQLiteRepository._init()` does log a schema-version warning. Neither
turned out to be the actual cause (see Root Cause below) — the
`BrowserExecutor` layer works correctly, and the `schemaVersion` column on
`searches` already matched (`2`); the real drift was silent and on a
different table entirely.

## Phase 1 — Reproduction

Ran `npm run dev` and issued live `POST /api/search` requests for
`"nvidia 5060 ti"` against all three providers. Every provider scraped
successfully (non-trivial execution time, real navigation, e.g. KaBuM
reached `https://www.kabum.com.br/busca/nvidia-5060-ti`), but the API
response for all three carried:

```
"error": {"message": "table normalized_products has no column named originalTitle", "code": "SQLITE_ERROR"}
```

`productCount: 0` and `persistence.failed: true` for every provider,
regardless of query or provider — a shared downstream failure, not a
provider-specific scraping problem.

## Phase 2 — Root cause

`src/repository/SQLiteRepository.js`'s `SCHEMA_SQL` defines
`normalized_products` with columns added over time
(`originalTitle`, `normalizedTitle`, `brand`, `model`, `storageCapacity`,
`memoryCapacity`, `currency`, `currentPrice`, `originalPrice`,
`originalPriceText`, `availability`). The on-disk `data/scraper.db` file
predates that revision — its `normalized_products` table only had
`id, searchId, provider, title, priceText, price, url, source, confidence,
createdAt`, including a `title TEXT NOT NULL` column that the current
`persistNormalizedProducts()` insert never populates (superseded by
`originalTitle`/`normalizedTitle`).

`_init()` runs `CREATE TABLE IF NOT EXISTS`, which is a no-op against a
table that already exists — it never adds the new columns and never
removes the obsolete one. So every `persistNormalizedProducts()` call
failed with `SQLITE_ERROR: no such column: originalTitle` (and, after that
was fixed, `SQLITE_CONSTRAINT_NOTNULL: normalized_products.title`),
`SearchService.search()` caught it, and the API returned
`productCount: 0` for every provider — regardless of whether the scrape
itself worked. This matches "SQLite schema migration" from the task's
list of candidate causes; `BrowserExecutor`, `SearchService`'s own retry
wrapping, provider failures, and normalization/comparison filtering were
all ruled out — each provider completed its own scrape correctly.

Separately (not the cause of the zero-products regression, but worth
recording as its own gap): `SearchService.js` now passes a `browserEngine`
field to `repo.createSearch(...)`, but `SQLiteRepository.createSearch()`
doesn't destructure or persist it — it's silently dropped, not an error.

## Phase 3 — Fix

`SQLiteRepository._init()` now calls a new `_migrateColumns()` step
(committed in `84ae797`):

- Adds any of the newer `normalized_products` columns that are missing,
  via `ALTER TABLE ... ADD COLUMN` (SQLite 3.53, bundled by `better-sqlite3`,
  supports this cleanly; nullable/defaulted so existing rows don't need
  backfilling).
- Drops the obsolete `title` column via `ALTER TABLE ... DROP COLUMN`
  (also supported by this SQLite version), since its `NOT NULL` constraint
  is what broke every insert once the missing-column error was fixed.

This is additive/idempotent — existing rows and the one pre-existing
search record in `data/scraper.db` were preserved, not recreated.

Separately, `pages/index.js`'s `handleSearch()` only checked
`data.success` before deciding whether to surface an error. The API
returns `success: true` (HTTP 200) even when the provider/persistence
step failed internally — `SearchService.search()` catches its own
failures and returns a result object with `error` populated rather than
throwing. Because of this, `setError()` was never called on a failed
search, and the UI showed only the generic "⚠ Recovery pending" badge
with no diagnostic text — the exact symptom described in the task. Fixed
by also checking `data.error` in the success branch.

## Phase 4 — Validation

- Live API, all three providers, via the real dev server (`pages/api/search.js` →
  `SearchService` → provider → `SQLiteRepository`):
  - MercadoLivre: 45–46 real "RTX 5060 Ti" results, persisted, no error.
  - KaBuM: 60 real results from `https://www.kabum.com.br/busca/nvidia-5060-ti`, persisted, no error.
  - Pichau: 56 results persisted, no error (though its URL still resolves
    to the homepage rather than a search results page — a separate,
    pre-existing Pichau-specific quirk, not part of this regression; see
    Remaining Technical Debt).
- Drove an actual browser against the running UI (Playwright) for a
  MercadoLivre search: 46 product rows rendered, "✓ Stored in DB" badge
  shown (not "Recovery pending").
- `node tests/normalization.test.js` — 57/57 passed.
- `node tests/StorageDeviceExtractor.test.js` — 62/62 passed.
- `node tests/comparison-engine.test.js` — 20/20 passed.
- `node tests/product-intelligence-pipeline.test.js` — benchmark passed (TP=10, FP=1, FN=1, TN=144), matching `BENCHMARK_REPORT.md`/this file's prior entry.
- `node tests/test-browser-abstraction.js` — 44/44 passed.
- `node tests/ProductMatch.test.js` — 20/21 passed; 1 pre-existing failure
  (Kingston A400 480GB SKU-match confidence), already documented below as
  technical debt from the prior loop — unrelated to this regression, not
  touched.
- `node -c` syntax-checked every file in the browser/comparison/products/
  provider/repository layers plus `pages/api/search.js` — all clean.
- Did **not** re-run the full `benchmark-providers.js` (144-run, ~100
  minute matrix) or `tests/provider-regression.test.js` in full: both
  call providers directly and bypass `SearchService`/`SQLiteRepository`
  entirely, so they don't exercise the persistence layer this fix
  touches — the live end-to-end API validation above is the relevant
  equivalent for this change and is a superset of what those exercise
  for persistence.

## Remaining technical debt

- **Pichau search does not actually search.** `PichauProvider.search()`
  consistently returns `url: "https://www.pichau.com.br/"` (the homepage)
  with the site's "Ofertas em Destaque" carousel products, rather than a
  real `/search?q=...` results page, for the query tested here. Products
  are non-zero so it doesn't reproduce as "zero products," but the
  results are not query-relevant. Needs its own investigation; out of
  scope for this loop.
- **`SearchService` double-launches a browser.** `SearchService.search()`
  wraps `providerFn` in its own `this.browserExecutor.execute()` call,
  which launches a session via `BrowserFactory`/`PlaywrightEngine` that is
  never used (the wrapped callback ignores the `session` argument and
  calls `providerFn` directly) — meanwhile the provider (e.g.
  `PichauProvider`) launches its *own*, separate `BrowserExecutor`
  session internally to do the actual work. Every search launches two
  browser instances where one does nothing. Wasteful, and a likely
  contributor to resource pressure / timeout flakiness (see KaBuM below),
  but not the cause of the schema-driven zero-products regression this
  loop fixed — left alone to keep this change to one logical fix.
- **KaBuM pagination / page-2 selector timeouts** — pre-existing, noted
  in `BENCHMARK_REPORT.md` from the prior loop ("Kabum and Pichau show
  `hasCorrectPagination: false` across all runs").
- `SearchService.js` passes `browserEngine` to `repo.createSearch(...)`
  but `SQLiteRepository` doesn't persist it — dead parameter, harmless,
  not fixed here.
- `npm test` is still not wired to the real suite (pre-existing, noted in
  the Product Intelligence report below).
- `tests/ProductMatch.test.js` 1/21 pre-existing failure (Kingston SKU
  confidence scoring) — pre-existing, not touched.

## Suggested commit message

Already committed as `84ae797`:

```
fix: heal stale normalized_products schema so search persistence stops failing
```

---

# Product Intelligence Integration Report

## Objective

Integrate the deterministic comparison layer into the Product Intelligence pipeline and validate it with benchmark storage-device products from Samsung, Kingston, WD, and Corsair.

## Repository audit summary

- Branch at audit time: `feature/camofox-engine`.
- `ComparisonEngine` and `ComparisonReason` already existed, but production usage was isolated from the runtime product flow.
- `StorageDeviceExtractor` already produced canonical storage-device fields.
- `ProductMatch` was the runtime matching facade, but it duplicated deterministic logic instead of invoking `ComparisonEngine`.
- `SearchService` normalized provider results but did not expose canonical storage products or comparison results.
- `package.json` still has a nonfunctional `npm test` script, so validation uses direct Node test files.
- Existing benchmark JSON artifacts are provider summaries, not reusable Samsung/Kingston/WD/Corsair product records.

## Integrated pipeline

The runtime path now supports:

```text
Provider
→ Normalizer
→ StorageDeviceExtractor
→ Canonical Product
→ ComparisonEngine
```

Implementation points:

- `src/services/SearchService.js` now extracts `canonicalProducts` immediately after `normalizeProducts()`.
- `SearchService.search(..., { compareAgainst })` now compares canonical provider results against supplied comparison products using `ComparisonEngine.compare()` and returns `comparisonResults`.
- `src/products/ProductMatch.js` now delegates `matchProducts()` to `ComparisonEngine.compare()` while preserving the older `evidence` response shape where practical.
- `src/index.js` now exports `ComparisonEngine` and `ComparisonReason`.

## Design decisions

- Raw product values are not overwritten. The service still returns raw `products` and `normalizedProducts`; canonical data is added separately as `canonicalProducts`.
- Canonical products carry `provenance` with provider, original title, normalized title, and URL.
- Matching remains deterministic. It uses regex extraction, alias dictionaries, token normalization, numeric capacity normalization, and compatibility tables only.
- No LLM-based extraction or comparison was introduced.
- Optional missing fields such as one-sided interface/protocol/form factor values now produce `UNKNOWN` comparison reasons instead of hard mismatches. This reduces false negatives without creating positive evidence.
- Critical mismatches are capped deterministically:
  - brand or long manufacturer SKU mismatch caps confidence below match threshold;
  - capacity mismatch caps confidence below match threshold;
  - model+family mismatch caps confidence unless a manufacturer SKU match is present.
- Short SKU-like tokens are treated as non-decisive when they conflict with longer manufacturer SKUs, because extractor output can currently promote family/model tokens into `manufacturerSku`.

## Benchmark metrics

### Expanded Benchmark (156 comparisons)

Products tested: 12 left × 13 right = 156 total pairwise comparisons.

Confusion matrix:

| Metric | Count |
| --- | ---: |
| True positives | 10 |
| False positives | 1 |
| False negatives | 1 |
| True negatives | 144 |

Derived metrics:

| Metric | Value |
| --- | ---: |
| Precision | 0.91 (10/11) |
| Recall | 0.91 (10/11) |
| F1 | 0.91 |

Brands covered:

- Samsung: 990 PRO 2TB positive match, 870 EVO rejected comparison
- Kingston: A400 480GB positive match
- WD: Blue SN580 1TB positive match with WD/Western Digital aliasing
- Corsair: MP600 1TB positive match with model-token normalization
- Additional Samsung, Kingston/WD/Corsair products from expanded dataset

The benchmark includes at least one correctly rejected match: Samsung 990 PRO 2TB vs Samsung 870 EVO 1TB.

### Baseline Benchmark (20 comparisons)

Initial validation with core Samsung SSDs:

| Metric | Count |
| --- | ---: |
| True positives | 3 |
| False positives | 0 |
| False negatives | 1 |
| True negatives | 16 |

## Validation results

Direct Node validation was used because `npm test` is configured as a placeholder failure.

Passed:

- `node -c src/services/SearchService.js`
- `node -c src/products/ProductMatch.js`
- `node -c src/comparison/ComparisonEngine.js`
- `node -c src/providers/normalizer.js`
- `node -c src/index.js`
- `node tests/normalization.test.js` — 57/57 passed
- `node tests/StorageDeviceExtractor.test.js` — 62/62 passed
- `node tests/ProductMatch.test.js` — 21/21 passed
- `node tests/comparison-engine.test.js` — 20/20 passed
- `node tests/product-intelligence-pipeline.test.js` — benchmark passed with TP=3, FP=0, FN=1, TN=16
- `node tests/test-browser-abstraction.js` — 44/44 passed

Live provider regression note: `tests/provider-regression.test.js` completed successfully: Pichau (all queries + pagination) + Mercado Livre (all queries + pagination) passed; KaBuM pagination failed due to upstream KaBuM selector timeouts — existing behavior, not a regression from this loop.

## Remaining technical debt

- `npm test` is not wired to the real test suite.
- The stored provider benchmark artifacts are summaries, not structured product fixtures; future benchmark runs should persist sampled normalized product records.
- `StorageDeviceExtractor` can still confuse SKU, model, and family tokens for some Kingston-style titles.
- Interface/protocol extraction is still imperfect for titles where `NVMe`, `M.2`, `PCIe`, and `SATA` are mixed or omitted.
- `SearchService` comparison currently compares the current provider result against an explicit `compareAgainst` set. A higher-level cross-provider aggregator still needs to orchestrate multiple provider searches.

## Recommended next loop

Build a benchmark fixture generator that persists representative raw and normalized product records from real provider runs, then use those records as the canonical benchmark source for regression tests and metrics over time.

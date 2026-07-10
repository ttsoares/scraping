# OpenWiki Quickstart

This repository is a Next.js scraping console for Brazilian e-commerce product search.
It searches multiple retailers, normalizes product data, and persists results to SQLite so searches can be audited later.

## Start here

- [Architecture overview](architecture/overview.md) — request flow, provider layer, normalization, and persistence
- [Provider behavior](architecture/providers.md) — site-specific scraper behavior and robustness concerns
- [Data model and tests](data-and-tests.md) — SQLite schema, normalization rules, and the best verification checks

## What the system does

- Accepts search requests from the UI or `/api/search`
- Scrapes retailer results with Playwright + stealth
- Normalizes titles, brands, models, capacity, prices, and availability
- Persists search metadata, raw products, and normalized products in SQLite
- Returns both raw and normalized products so the UI can compare them side by side

## Core entrypoints

- `pages/api/search.js` — main POST API route; selects a provider and runs the search pipeline
- `pages/index.js` — engineering verification UI for provider selection, page changes, and raw/normalized display modes
- `src/services/SearchService.js` — orchestration layer that calls providers, normalizes products, and persists the result
- `src/repository/SQLiteRepository.js` — current storage backend and schema owner
- `src/providers/normalizer.js` — shared normalization utilities used by every provider

## Major domains

### Scraping providers

The repository currently supports three providers: `pichau`, `kabum`, and `mercadolivre`.
Each provider has its own DOM strategy and timing behavior, but they all return a compatible response shape.

### Persistence

Search execution is no longer ephemeral.
A search creates a durable record in SQLite, along with the raw product rows and the normalized product rows.
That makes failure analysis, comparisons, and future history features possible.

### Normalization

The shared normalizer removes UI noise from titles, extracts brand/model/capacity information, normalizes BRL prices, and infers availability.
The normalization logic intentionally preserves original values alongside derived fields.

### UI and verification flow

`pages/index.js` acts as a manual engineering console.
It is useful for checking whether provider changes still produce reasonable raw and normalized output.

## High-signal source files

- `docs/ARCHITECTURE.md` — original architecture notes and rationale
- `docs/NORMALIZATION.md` — detailed normalization rules and field extraction behavior
- `docs/KABUM_IMPLEMENTATION.md` — KaBuM-specific scraping notes
- `tests/provider-regression.test.js` — multi-provider regression coverage
- `tests/normalization.test.js` — unit coverage for the shared normalizer

## What to watch out for

- Provider selectors and waiting strategies are site-specific and brittle.
- KaBuM behaves like an SPA and needs a fixed post-search wait.
- `SearchService` persists failed searches too, so error handling affects the database as well as the API response.
- The repository already separates raw and normalized data; preserve that distinction when changing models.
- Existing docs in `docs/` include both source-backed notes and future-looking recommendations. Prefer current source code when they differ.

## Suggested change workflow

When changing scraping or persistence behavior:

1. Update the provider or normalization logic.
2. Re-run `tests/normalization.test.js`.
3. Re-run `tests/provider-regression.test.js`.
4. Confirm `/api/search` still returns search metadata, raw products, normalized products, and persistence information.
5. Check that the UI still renders the expected comparison view.

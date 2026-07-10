# Providers and Scraping Behavior

## What this section covers

The repository’s core knowledge is the provider layer: scraping Brazilian e-commerce sites, extracting product cards, and coping with retailer-specific DOM and pagination rules.

The current supported providers are:

- Pichau
- KaBuM
- MercadoLivre

All providers feed the same API and persistence pipeline, but each one has its own search URL shape, selector strategy, and pagination logic.

## Shared contract

Providers are expected to expose a CommonJS module with:

- `search(query, options)`
- `shutdown()`

The API and `SearchService` depend on that contract, not on provider internals.

The raw product objects usually contain at least:

- `title`
- `price`
- `priceText`
- `url`
- `source` or `provider`

`SearchService` then maps `provider` onto each product before normalization and persistence.

## Pichau

Pichau is the most DOM-specific provider in the repository and the one that motivated the original scraping architecture.

Key behavior:
- search is driven from the homepage search box
- results are extracted from `a[data-cy="list-product"]`
- pagination uses `page=` query parameters
- the site required stealth/browser hardening during research

Notable constraints from the research notes and architecture docs:
- Cloudflare/maintenance behavior was observed during earlier experiments
- the provider uses browser reuse and explicit cleanup
- DOM extraction is preferred over network interception because the search page is easier to validate against visible HTML

## KaBuM

KaBuM behaves differently from Pichau:
- search navigation lands in a Next.js SPA flow
- results are extracted with broader DOM filtering because the page structure is noisier
- pagination uses `page_number=`
- title cleanup removes promo prefixes and installment text

The KaBuM implementation is documented in detail in the repository’s historical notes because it required a different extraction strategy than Pichau.

Main practical lesson:
- do not assume a selector that works for one retailer will work for the others
- pagination and timing are retailer-specific, not a shared abstraction

## MercadoLivre

MercadoLivre was added later and fits the same provider contract, but with a more server-rendered HTML flow.

Observed behavior in the repository notes:
- search URLs use a slugged listing path
- products are rendered as list items in the HTML
- pagination uses `_Desde_..._NoIndex_True` offsets
- ads and analytics traffic appear in the page capture, so scraping should focus on the product-item selectors rather than page-wide assumptions

## Shared normalization concerns

Provider output is not treated as final. The repository uses a shared normalizer to clean titles, detect brands and models, extract storage and memory capacities, and normalize prices.

That means provider changes often affect two things:
1. scraping selectors / extraction logic
2. downstream normalization quality

When changing a provider, check both raw result shape and normalized output.

## Where future agents should look first

- `src/providers/pichau/PichauProvider.js`
- `src/providers/kabum/KabumProvider.js`
- `src/providers/mercadolivre/MercadoLivreProvider.js`
- `src/providers/normalizer.js`
- `docs/KABUM_IMPLEMENTATION.md`
- `docs/NORMALIZATION.md`
- `docs/research/`

## Change guidance

- If results suddenly drop to zero, inspect selector changes first.
- If prices look wrong but titles are correct, inspect `parsePrice` and the normalizer.
- If the UI still shows raw items but persistence is incomplete, inspect `SearchService` and `SQLiteRepository`.

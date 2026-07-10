# Provider Behavior

This repository supports multiple scraping providers that all feed the same search pipeline.
The providers differ in how they navigate the retailer site, how they detect results, and how they recover from DOM or anti-bot issues.

## Providers in the repository

### Pichau

Pichau was the original provider and uses a more direct page flow:

- goes to the retailer search page
- finds a search input by placeholder text
- waits for products to appear using a dynamic wait strategy
- extracts product cards from the DOM
- uses `page=` style pagination

### KaBuM

KaBuM has the most specific documented caveats in the repository:

- the site behaves like a Next.js SPA
- search stays on the homepage URL rather than navigating to a dedicated results page
- product extraction uses broad `div` filtering with link + price heuristics
- pagination uses `page_number=` query parameters
- a fixed post-search wait is used because `networkidle` is not enough

The dedicated KaBuM implementation notes in `docs/KABUM_IMPLEMENTATION.md` are still the best high-level source for its search flow and known limitations.

### Mercado Livre

Mercado Livre was added later and is exposed through the same API and UI controls.
The important architectural point is not the site-specific selectors themselves, but that it conforms to the same provider contract and can be swapped through `/api/search`.

## Shared provider contract

The providers are expected to return a compatible response shape containing at least:

- `query`
- `url`
- `products`
- `pagination`
- `source`

Each product should include the core fields used by the rest of the system:

- `title`
- `price`
- `priceText`
- `url`
- `provider` or `source`

That stable shape is what makes `SearchService` and the UI provider-agnostic.

## Common implementation pattern

The API route keeps singleton instances for the providers so repeated requests can reuse the same browser/page state.
That is a practical optimization, but it also means provider state can become flaky if a site changes or if a previous search leaves the page in an unexpected state.

## Robustness concerns

The repository has accumulated several provider-specific failure modes:

- anti-bot or Cloudflare challenges
- brittle selectors
- browser/page reuse issues
- inconsistent pagination behavior
- site-specific timing differences

These concerns are why there are separate regression-style tests under `tests/` and why provider implementations are intentionally isolated.

## Verification files

- `tests/provider-regression.test.js` — main multi-provider regression coverage
- `tests/test-*.js` — older provider smoke tests kept in the tree as historical evidence
- `docs/ROBUSTNESS.md` — technical debt and failure-mode notes

## What to watch when changing providers

- Keep the output contract stable so SearchService and the UI do not break.
- Update pagination handling carefully; the API and UI assume `pagination.currentPage`, `pages`, `nextPageUrl`, and `hasNextPage` are present when available.
- Re-run the regression tests after changing selectors, navigation, or price parsing.
- Prefer preserving raw provider text and letting the normalizer create derived fields.

## Related source files

- `pages/api/search.js`
- `src/providers/normalizer.js`
- `tests/provider-regression.test.js`
- `docs/KABUM_IMPLEMENTATION.md`
- `docs/ARCHITECTURE.md`
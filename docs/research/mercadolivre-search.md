# MercadoLivre search research

## How search works
- The homepage search input (selectors seen: `input[name="as_word"]`, `input[name="q"]`, `input[type="search"]`) triggers a full-page navigation, not an in-page API call.
- Queries are normalized into the URL path. Example: `ssd 1tb` → `https://lista.mercadolivre.com.br/ssd-1tb`.
- Results are server-rendered HTML with product cards in `li.ui-search-layout__item` and anchors such as `a.ui-search-link` / `[data-item-id] a`.
- Inline scripts include an `initialState` marker plus `application/ld+json` and `application/json` blocks, indicating server-side state hydration.

## Which requests are made
Observed during a Playwright run with `ssd 1tb`:
- Main navigation:
  - `GET https://www.mercadolivre.com.br/`
  - `GET https://lista.mercadolivre.com.br/ssd-1tb`
- Pagination navigation (client-side click):
  - Page 2: `https://lista.mercadolivre.com.br/ssd-1tb_Desde_49_NoIndex_True` (48 results per page; offset = (page-1)*48 + 1)
  - Page 3: `https://lista.mercadolivre.com.br/ssd-1tb_Desde_97_NoIndex_True`
  - Some navigations redirect to category paths, but the `_Desde_` pattern works directly from the base URL.
- Supporting requests (non-search data):
  - `GET https://www.mercadolivre.com.br/adn/api?...` (ads)
  - `POST https://api.mercadolibre.com/melidata/tracks` (analytics)
  - `POST https://api.mercadolibre.com/melidata/tracks/component_prints` (analytics)
  - Static assets from `https://http2.mlstatic.com/...`

## REST or GraphQL
- The search results themselves are delivered as HTML documents (no GraphQL).
- The only JSON/REST calls seen are analytics and ad endpoints (`melidata`, `adn`).

## Infinite scrolling
- No infinite scroll markers were detected (`[class*="infinite"]`, `[data-infinite]` absent).
- Pagination is present, but links are populated via client-side handlers; clicking page numbers navigates to `_Desde_<offset>_NoIndex_True` URLs.

## Which headers matter
Headers observed on the search document request:
- `user-agent`
- `accept-language`
- `referer`
- `sec-ch-ua`, `sec-ch-ua-platform`, `sec-ch-ua-mobile`
- `device-memory`, `dpr`, `viewport-width`
- `upgrade-insecure-requests`

No custom auth headers or API keys were required for the HTML search page.

## Visible anti-bot mechanisms
- No Cloudflare challenge or CAPTCHA elements were detected in the DOM.
- The site does load tracking/telemetry (melidata, ping.gif, tag manager), but no explicit bot block was triggered in headless + stealth runs.

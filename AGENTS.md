# Repository notes

## Pichau research (Loop 2)
- Vanilla Playwright was blocked: request to `https://www.pichau.com.br/produtos?busca=pc` returned **403** and `snapshot.html` title was "Site em Manutenção - Pru Pru" (Cloudflare/maintenance).
- Stealth setup (`playwright-extra` + `puppeteer-extra-plugin-stealth`) loaded the application HTML, but the same URL returned **404** with title "404 - Página não encontrada | Pichau". Canonical URL points to the homepage.
- Site uses Next.js app router; HTML contains `self.__next_f.push` streaming payload and static assets from `https://static.pichau.com.br/_next/static/`.
- Observed JSON endpoints in the stealth run:
  - `https://www.pichau.com.br/api/request/new-products`
  - `https://www.pichau.com.br/api/request/highlights`
  No GraphQL or search-specific JSON endpoints were seen in the captured logs.
- Product cards appear in HTML with `a[data-cy="list-product"]`, title in `h2`, and price classes like `.price_vista`.
- Artifacts saved in `experiments/research/outputs/stealth-plugin/` (snapshot, requests/responses, cookies, screenshot).

## Pichau research (Loop 3)
- Search UI on the homepage triggers client-side navigation to `https://www.pichau.com.br/search?q=ssd%201tb%20sata`.
- Network shows `POST /search?q=...` with `Accept: text/x-component` and body `"[\"ssd 1tb sata\"]"`; response is RSC (`text/x-component`) containing JSON-like arrays.
- `GET /search?q=...&_rsc=...` requests also fire (body not captured in this run).
- Rendered DOM contains the full product grid (36 `a[data-cy="list-product"]` cards); JSON-LD is only a breadcrumb list.
- Pagination links use `page=` query parameter (e.g., `/search?q=ssd+1tb+sata&page=2`).
- Cloudflare remains in front; stealth run set `cf_clearance` and `__cf_bm` cookies.


## Pichau provider implementation
- Implemented minimal `PichauProvider` using Playwright + stealth and DOM extraction from `a[data-cy="list-product"]`.
- Provider reuses a shared browser context/page across searches and always starts from the homepage search input.
- Pagination is detected by collecting `page=` links on the search page.


## Kabum provider notes
- Kabum search navigates to `/busca/<query>`; wait for the URL change before scraping results.
- Product cards are anchored by `a[href*="/produto/"]`.
- Price text often includes list + pix + installment prices; ignore matches preceded by "x de" to drop installment values.
- Title extraction may include promo prefixes; cleanup strips "Selo:", "Produto Patrocinado", and rating prefixes.


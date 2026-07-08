# Provider Comparison Report

> Analysis of Pichau, Kabum, and MercadoLivre scraping providers, based on codebase analysis of `src/providers/`.

---

## 1. PichauProvider

**Source:** `src/providers/pichau/PichauProvider.js`
**Base URL:** `https://www.pichau.com.br/`
**Browser Stack:** Playwright-extra + puppeteer-extra-plugin-stealth

### 1.1 Search Strategy

- **Entry Point:** Homepage search bar simulation. The provider navigates to `https://www.pichau.com.br/` and interacts with the search input as a user would.
- **Input Locator:** `input[placeholder*="procurando"]`, `input[aria-label="Buscar produtos"]`, or `input[role="searchbox"]`.
- **Flow:** Click → Fill query → Press Enter (keyboard simulation).
- **Rendering Detection:** Waits for `networkidle` (waits for network to quiet down) after navigation. RSC (React Server Components) is used — a custom `waitForFunction` counts product cards with non-empty `<h2>` text to confirm results are fully rendered, stable for 300ms.
- **URL Pattern:** The URL is determined by React RSC navigation after the search. The resulting URL contains a `?page=N` query parameter for pagination.

### 1.2 Rendering Strategy

- **Product Selector:** `a[data-cy="list-product"]` — all product cards are links with the `data-cy="list-product"` attribute (RSC-specific data attribute).
- **Title Extraction:** `<h2>` text content within each card.
- **Price Extraction:** `.price_vista`, `.price_total`, or `[class*="price"]` selectors. Falls back gracefully if the element exists but has no text.
- **URL Extraction:** `href` attribute on the card `<a>` — resolved to absolute using `normalizeProducts()`.
- **Stability Measure:** Performs a double-select with a 500ms retry — if the first `$$eval` returns 0 products, it retries once more after a short delay.
- **Client-Side Rendering:** Products are rendered via React RSC navigation. The DOM may briefly show 0 products during transition; the custom `waitForFunction()` with a 10s timeout confirms a stable product count.

### 1.3 Pagination Strategy

- **DOM Detection:** Extracts `a[href*="page="]` links from the DOM and uses the shared `createPaginationState()` with the `page` parameter.
- **URL Pattern:** `?page=N` (e.g., `?page=2`, `?page=3`). Page numbers are numeric.
- **Navigation:** When `pageNum > 1`, sets the query param directly via `URL.searchParams.set('page', N)` and navigates with `networkidle`.
- **Button Detection:** Uses numeric page numbers (1, 2, 3...) derived from the DOM link `href` values.

### 1.4 Average Execution Time

Estimated: **6-10 seconds** for a full search.

- `goto()` with `networkidle`: ~3s
- `waitForSelector('a[data-cy="list-product"]')`: up to 30s, typically resolves quickly
- `waitForFunction()` for product count: up to 10s, typically resolves in 1-2s
- Product extraction `$$eval`: ~200ms
- Additional 300ms stability buffer + 500ms retry margin

### 1.5 Products Per Page

**~60 products per page.** Pichau's product grid displays 60 items per page. The implementation does not hard-code this number - it counts all `a[data-cy="list-product"]` cards with a non-empty `<h2>`, so dynamic page sizes are handled.

### 1.6 Anti-Bot Observations

- **Stealth Plugin:** Uses `puppeteer-extra-plugin-stealth()` which hides `window.navigator.webdriver`, overrides `chromium` toString, and patches common detection vectors.
- **Cloudflare Detection:** Custom `checkCloudflare()` function checks if the page title includes "Manutenção" or "Pru Pru" to detect Cloudflare challenges. Throws a `CloudflareDetected` error (code: `CLOUDFLARE`).
- **Custom Error Types:** Six specific error classes (`CloudflareDetected`, `NoProductsFound`, `SearchInputNotFound`, `NavigationError`, `TimeoutError`, `DomChanged`) provide granular error differentiation.
- **Health Check:** Periodic `healthCheck()` validates `document.body` existence and valid `window.location.href`.

### 1.7 Maintenance Risk

**Medium-High.**

- **Strengths:** URL-based `data-cy="list-product"` is reasonably stable; custom retry logic handles transient RSC transitions.
- **Risks:** The `data-cy` attribute is tied to Pichau's RSC/React implementation; if Pichau migrates away from RSC data attributes, selectors could break. Cloudflare detection relies on specific Portuguese text strings ("Manutenção", "Pru Pru") in the page title; these could change with Cloudflare updates. Price selectors use specific class names (`.price_vista`, `.price_total`) which are moderately stable.

### 1.8 Confidence Level: **High**

Robust error handling (6 custom error types), stealth plugin, health checks, double-select retry, and explicit waiting all contribute to high reliability.

---

## 2. KabumProvider

**Source:** `src/providers/kabum/KabumProvider.js`
**Base URL:** `https://www.kabum.com.br/`
**Browser Stack:** Playwright-extra + puppeteer-extra-plugin-stealth

### 2.1 Search Strategy

- **Entry Point:** Homepage search bar simulation. Navigates to `https://www.kabum.com.br/` and interacts with the search input.
- **Input Locator:** `input[name="query"]` — identifies Kabum's search field by its `name` attribute.
- **Flow:** Click with `force: true` (bypasses overlay blockers) → Fill query → Press Enter.
- **Rendering Detection:** Uses `domcontentloaded` (faster than `networkidle`). Waits for both a URL change (navigation to `/busca/`) and the appearance of product links (`a[href*="/produto/"]`).
- **URL Pattern:** After search, the URL transforms from the homepage to `.../busca/{query}`. The SPA (Single Page Application) renders results without a full page reload.

### 2.2 Rendering Strategy

- **Product Selector:** `a[href*="/produto/"]` — **URL-based**, which is more resilient than class-name selectors. Any link containing `/produto/` is treated as a product.
- **Title Extraction:** Complex text cleaning pipeline:
  1. Collects all `<br>`-separated text lines from the link.
  2. Removes "Selo: ...", "Produto Patrocinado", "Avaliação X,Y de A,B", "Frete grátis*" patterns via regex.
  3. Collapses whitespace and trims.
  4. Falls back to the first long text segment (>10 chars) that lacks price/discount/shipping keywords.
- **Price Extraction:** Regex `/R\$\s*[\d.]+,?\d*/g` with an "x de" filter to exclude installment prices (e.g., "12x de R$ 100").
- **URL Extraction:** `href` attribute on each link — resolved to absolute URL by `normalizeProducts()`.
- **Product Cap:** Hard-coded cap of **80 products** per extraction (`if (results.length >= 80) break`), preventing excessive processing.
- **Deduplication:** Uses a `seen` Set for href attributes to avoid duplicate entries from multiple links on the same card.
- **SPA:** MercadoLivre's SPA means no full page reloads; results update via React hydration, reducing anti-bot signals.

### 2.3 Pagination Strategy

- **DOM Detection:** Inline implementation (not shared) extracts `a[href*="page_number="]` links from the DOM.
- **URL Pattern:** `?page_number=N` (e.g., `?page_number=2`). Uses the `page_number` parameter rather than a generic `page`.
- **Navigation:** When `pageNum > 1`, sets `page_number` via `URL.searchParams.set()` and navigates with `domcontentloaded` (fast) plus 1.5s stabilization.
- **Button Detection:** Extracts numeric page values from DOM links, deduplicates with a Map, and sorts ascending.

### 2.4 Average Execution Time

Estimated: **4-8 seconds** for a full search.

- `goto()` with `domcontentloaded`: ~1-2s (faster than Pichau's `networkidle`)
- `waitForURL()` for `/busca/`: typically <1s
- `waitForSelector('a[href*="/produto/"]')`: fast (<1s)
- Product extraction `$$eval` with complex text processing: ~500ms-1s
- Additional 1.5s stabilization for SPA rendering

**Faster than Pichau** due to `domcontentloaded` vs `networkidle` and the absence of the custom `waitForFunction()` step.

### 2.5 Products Per Page

**Up to 80 products per page** (code cap), though Kabum typically displays **~60 products** per page. The 80 cap is set deliberately to avoid processing stale/spurious DOM elements. The actual count is determined by `$$eval('a[href*="/produto/"]')`.

### 2.6 Anti-Bot Observations

- **Stealth Plugin:** `puppeteer-extra-plugin-stealth()` applied (same as other providers).
- **Force Click:** Uses `click({force: true})` on the search input, bypassing CSS overlays and pointer-event blockers.
- **SPA Navigation:** Uses `domcontentloaded` instead of full network idle, resulting in fewer network artifacts that anti-bot systems monitor.
- **Singleton Pattern:** Shared `browser`, `context`, `page` objects persist across searches, reducing the number of browser launches — lower fingerprint.

### 2.7 Maintenance Risk

**Medium.**

- **Strengths:** URL-based product detection (`/produto/`) is very stable across Kabum's UI evolution. SPA architecture means the DOM structure changes less frequently than traditional server-rendered pages.
- **Risks:** The title cleaning pipeline uses multiple regex patterns targeting specific Portuguese text strings — if Kabum changes product labels ("Selo:", "Produto Patrocinado", etc.), the cleaning logic may need updating. The `input[name="query"]` selector could break if Kabum renames the search form field. The explicit 80-product cap might not adapt well if Kabum changes the page layout to show more products.

### 2.8 Confidence Level: **High**

Strong URL-based selectors, SPA navigation, robust title cleaning, and force-click all contribute. The main risk is the complex regex pipeline in title extraction.

---

## 3. MercadoLivreProvider

**Source:** `src/providers/mercadolivre/MercadoLivreProvider.js`
**Base URL:** `https://www.mercadolivre.com.br/`
**Search Base:** `https://lista.mercadolivre.com.br/`
**Browser Stack:** Playwright-extra + puppeteer-extra-plugin-stealth

### 3.1 Search Strategy

- **Entry Point:** **Direct URL construction** (not search bar simulation). Builds the MercadoLivre search URL directly without interacting with the DOM.
- **Query Transformation:** Uses `toSearchSlug(query)` from shared - URL-encodes the query and replaces `%20` with hyphens (`-`). For example, "rtx 5070" → "rtx-5070".
- **URL Pattern:**
  - **Page 1:** `https://lista.mercadolivre.com.br/{query-slug}` (e.g., `https://lista.mercadolivre.com.br/rtx-5070`)
  - **Page N:** `https://lista.mercadolivre.com.br/{query-slug}_Desde_{offset}_NoIndex_True` where `offset = (pageNum - 1) * 48 + 1`
  - Example page 2: `https://lista.mercadolivre.com.br/rtx-5070_Since_49_NoIndex_True`
- **Navigation:** Uses `domcontentloaded` with a 30s timeout. After navigation, waits for `li.ui-search-layout__item` to appear and 1.5s for stabilization.

### 3.2 Rendering Strategy

- **Product Selector:** `li.ui-search-layout__item` — MercadoLivre's standard product card element.
- **Product Exclusion:**
  - Ads are excluded via selectors `.poly-component__ads-promotions` and `.ui-search-item__ad`.
  - External links filtered out: `publicidade.mercadolivre.com.br`, `mercadoclics`, `click`.
- **Title Extraction:** `h2`, `.ui-search-item__title`, or `.poly-component__title` text content.
- **Price Extraction:** Primary: `.poly-price__current [data-andes-money-amount]` or `.ui-search-price__part [data-andes-money-amount]`. Fallback: full text from `.ui-search-price` or `.poly-price__current`.
- **URL Extraction:** All `a[href]` within the product card, normalized to exclude ad/sponsored URLs.
- **Data Attributes:** Heavily relies on MercadoLivre's `data-andes-*` attributes (`data-andes-money-amount`) and the `andes-` CSS naming convention.
- **DOM-Based Pagination:** After extraction, reads `.andes-pagination__button` buttons from the DOM to detect total pages, current page, and next page.

### 3.3 Pagination Strategy

- **Dual Approach — URL + DOM:**
  1. **URL-based (primary, for navigation):** Uses the `_Desde_{offset}_NoIndex_True` URL pattern. The offset is calculated as `(pageNum - 1) * 48 + 1`.
  2. **DOM-based (for metadata):** Reads `.andes-pagination__button` elements from the rendered page:
     - Numeric text content identifies individual page numbers.
     - `.andes-pagination__button--current` marks the active page.
     - `.andes-pagination__button--next` with `::disabled` class or `[data-andes-state="disabled"]` indicates no more pages.
- **Results Per Page:** Constant `RESULTS_PER_PAGE = 48` — hard-coded in the source.
- **URL Construction for Next Page:** `buildPageUrl(query, currentPageNumber + 1)` generates the next page URL directly from the formula.

### 3.4 Average Execution Time

Estimated: **3-6 seconds** for a full search.

- `goto()` with `domcontentloaded`: ~0.5-1s (fastest — navigates directly to a pre-built URL)
- `waitForSelector('li.ui-search-layout__item')`: ~1s
- Additional 1.5s stabilization
- Product extraction `$$eval`: ~300ms
- DOM pagination detection: ~200ms

**Fastest of the three** — direct URL construction avoids search bar interaction overhead, and `domcontentloaded` is faster than `networkidle`.

### 3.5 Products Per Page

**Exactly 48 products per page** (constant `RESULTS_PER_PAGE = 48`). MercadoLivre's product grid consistently displays 48 items per page. The URL offset-based pagination is calculated from this constant: each page shift by 48 items.

### 3.6 Anti-Bot Observations

- **Stealth Plugin:** `puppeteer-extra-plugin-stealth()` applied (shared with other providers.)
- **Direct URL Approach:** By constructing URLs directly (rather than simulating search bar interactions), the provider minimizes interaction-based bot detection. This is the most "bot-friendly" strategy among the three.
- **Stable CSS Naming:** MercadoLivre uses a well-documented, consistent naming convention (`ui-`, `poly-`, `andes-` prefixes) that rarely changes.
- **Large Scale:** MercadoLivre is a massive marketplace with high bot tolerance — it is designed to handle thousands of automated requests simultaneously.

### 3.7 Maintenance Risk

**Low.**

- **Strengths:** Direct URL construction is the most robust approach — MercadoLivre has used the same URL patterns for years. CSS selectors rely on MercadoLivre's official `andes-` and `ui-` naming conventions which are part of their design system. The `data-andes-money-amount` data attribute is stable. Product exclusion rules (ads, sponsored links, external URLs) are well defined.
- **Risks:** The hard-coded `RESULTS_PER_PAGE = 48` means if MercadoLivre ever changes its grid to display a different number of products, pagination offsets would need adjustment. The URL pattern uses MercadoLivre-specific tokens (`_Desde_`, `_NoIndex_True`) which could theoretically change, though this is unlikely given their longevity.

### 3.8 Confidence Level: **High** (Most Robust)

The most robust provider of the three. Direct URL construction (no DOM interaction for search), stable CSS naming conventions, explicit ad exclusion, well-documented pagination patterns, and MercadoLivre's own mature design system all contribute.

---

## 4. Comparison Table

| Attribute | PichauProvider | KabumProvider | MercadoLivreProvider |
|---|---|---|---|
| **Source File** | `pichau/PichauProvider.js` | `kabum/KabumProvider.js` | `mercadolivre/MercadoLivreProvider.js` |
| **Base URL** | `https://www.pichau.com.br/` | `https://www.kabum.com.br/` | `https://www.mercadolivre.com.br/` |
| **Search Base** | Self (RSC navigation) | Self (SPA: `/busca/`) | `https://lista.mercadolivre.com.br/` |
| **Search Method** | Search bar simulation (click → fill → Enter) | Search bar simulation (force click → fill → Enter) | **Direct URL construction** (no interaction) |
| **Input Selector** | `input[placeholder*="procurando"]`, `aria-label="Buscar produtos"`, `role="searchbox"` | `input[name="query"]` | N/A (URL-based) |
| **Navigation Wait** | `networkidle` | `domcontentloaded` | `domcontentloaded` |
| **Product Selector** | `a[data-cy="list-product"]` | `a[href*="/produto/"]` | `li.ui-search-layout__item` |
| **Title Selector** | `h2` within card | Complex text cleaning (regex pipeline) | `h2`, `.ui-search-item__title`, `.poly-component__title` |
| **Price Selector** | `.price_vista`, `.price_total`, `[class*="price"]` | `/R\$\s*[\d.]+,?\d*/g` regex | `.poly-price__current [data-andes-money-amount]` |
| **Pagination Param** | `page=N` | `page_number=N` | `_Desde_{offset}` in URL path |
| **Pagination Detection** | DOM links (`a[href*="page="]`) + shared `createPaginationState()` | Inline DOM detection (`a[href*="page_number="]`) | **Dual**: URL pattern + DOM (`.andes-pagination__button`) |
| **Next Page** | `pageMap.get(nextPage)` | Inline: `pages.find(n > currentPage)` | `buildPageUrl(query, currentPage+1)` |
| **Products Per Page** | ~60 (dynamic) | Up to 80 (capped at 80) | **48** (constant) |
| **Average Execution** | 6-10 seconds | 4-8 seconds | **3-6 seconds** (fastest) |
| **Rendering** | React RSC (client-side with hydration) | SPA/React (client-side) | SPA (`domcontentloaded` + stable DOM) |
| **Anti-Bot** | Stealth plugin + Cloudflare detection via title text | Stealth plugin + force click + SPA | Stealth plugin + direct URL (minimal interaction) |
| **Ad/Sponsored Filter** | Implicit (title text-based filter) | Regex cleaning of labels | Explicit selectors (`.poly-component__ads-promotions`, `mercadoclics`, `publicidade.*`) |
| **Retry Strategy** | Double `$$eval` with 500ms gap | Single pass with href dedup Set | Single pass with URL-based normalization |
| **URL Pattern for Pages** | `?page=N` (query param) | `?page_number=N` (query param) | `/{slug}_Desde_{offset}_NoIndex_True` (path-based) |
| **Error Handling** | 6 custom error types (CloudflareDetected, NoProductsFound, etc.) | Standard errors | Standard errors with `.catch()` guards |
| **Maintenance Risk** | Medium-High (RSC-dependent `data-cy`, Cloudflare text detection) | Medium (URL-based + regex pipeline) | **Low** (stable URL patterns + design system) |
| **Confidence Level** | **High** | **High** | **High (Most Robust)** |
| **Browser Lifecycle** | Singleton (shared browser/context/page) | Singleton (shared browser/context/page) | Singleton (shared browser/context/page) |

---

## 5. Key Code Patterns Across Providers

### Shared Utilities (`src/providers/shared.js`)

All three providers share code for:
- **Price Parsing:** `parsePrice()` — handles Brazilian format "R$ 1.299,90" → `1299.90`
- **Product Normalization:** `normalizeProducts()` — URL resolution, deduplication, source tagging
- **Slug Building:** `toSearchSlug()` — URL encoding + space-to-hyphen conversion
- **URL Construction:** `buildSearchUrl()` — joins base URL with query slug
- **Pagination State:** `createPaginationState()` — shared pagination detection with URL param extraction

### Common Patterns

| Pattern | Implementation |
|---|---|
| **Singleton Browser** | All use module-level `browser`, `context`, `page` variables with `ensurePage()` / `healthCheck()` pattern |
| **Headless Mode** | `chromium.launch({headless: true})` |
| **Stealth** | `puppeteer-extra-plugin-stealth()` applied via `chromium.use()` |
| **Error Types** | Provider-specific subclasses of `Error` with `code` property for meaningful differentiation |
| **Schema** | All produce `{ query, url, products[], pagination, source }` |
| **Product Schema** | `{ title, price (number), priceText (string), url (absolute), source }` |

# MercadoLivre Search — Research Report

## 1. How Search Works

MercadoLivre's search is **URL-driven**, not interaction-driven:

1. Queries are normalized into a URL slug (spaces → hyphens, percent-encoded).
2. The search base URL is `https://lista.mercadolivre.com.br/`.
3. For example, `ssd 1tb` → `https://lista.mercadolivre.com.br/ssd-1tb`.
4. The page is server-rendered HTML (no React hydration of a bare shell — the product grid is in the initial HTML).
5. Product cards are `li.ui-search-layout__item` elements.
6. Pagination is **page-based**, not infinite scroll. Each page shift constructs a new URL with an offset:
   - Page 2: `.../ssd-1tb_Desde_49_NoIndex_True`
   - Page 3: `.../ssd-1tb_Desde_97_NoIndex_True`
   - The offset formula is `(pageNum - 1) * 48 + 1` (48 results per page, a constant.)

The provider **bypasses** the homepage search bar entirely and navigates directly to the constructed URL.

## 2. Requests Made

| Request | Method | Purpose |
|---------|--------|---------|
| `GET https://lista.mercadolivre.com.br/{slug}` | GET | Main search results page |
| `GET https://lista.mercadolivre.com.br/{slug}_Desde_{offset}_NoIndex_True` | GET | Pagination (URL-based) |
| `GET https://www.mercadolivre.com.br/` | GET | Homepage (initial load, skipped in optimized flow) |
| `POST https://api.mercadolibre.com/melidata/tracks` | POST | Analytics/telemetry |
| `POST https://api.mercadolibre.com/melidata/tracks/component_prints` | POST | Component-level analytics |
| `GET https://www.mercadolivre.com.br/adn/api?...` | GET | Ads data |
| Various `GET https://http2.mlstatic.com/...` | GET | Static assets (images, JS bundles) |

The **only** search-relevant data is the initial HTML document for the URL. Pagination is also a simple URL-based GET. No search-specific JSON or GraphQL endpoints.

## 3. REST or GraphQL?

**REST / HTML.** MercadoLivre delivers search results as server-rendered HTML documents. No GraphQL queries. The `melidata` endpoints are analytics (POST JSON) and the `adn/api` is REST for ads — neither carries product search data.

This contrasts with Pichau (React RSC) and Kabum (SPA with React) which share JavaScript-based patterns but differently. MercadoLivre's approach is the most straightforward: HTML + URL routing.

## 4. Infinite Scrolling?

**No.** MercadoLivre uses traditional pagination. No `[class*="infinite"]` or `[data-infinite]` markers. The provider confirms this: pagination links are populated via the `_Desde_{offset}` URL pattern, and `.andes-pagination__button` DOM buttons report the page numbers. No virtualized/infinite list detected.

## 5. Which Headers Matter

| Header | Importance | Notes |
|--------|-----------|-------|
| `user-agent` | High | Standard Chromium UA required |
| `accept-language` | Medium | PT-BR preferred |
| `referer` | Medium | Present on search requests |
| `sec-ch-ua` / `sec-ch-ua-platform` / `sec-ch-ua-mobile` | Medium | Modern Chromium fingerprinting |
| `device-memory`, `dpr`, `viewport-width` | Low | Browser capabilities pass-through |
| `upgrade-insecure-requests` | Low | Standard HTTPS upgrade |
| `content-type` (POST) | Medium | `application/json` for melidata |

No custom auth headers or API keys are required for the HTML search page. The **stealth plugin** (`puppeteer-extra-plugin-stealth`) is critical: it hides `window.navigator.webdriver`, patches Chromium detection vectors, and prevents the `navigator.webdriver = true` leak that marks headless bots.

## 6. Anti-Bot Mechanisms

| Mechanism | Detail |
|-----------|--------|
| **Cloudflare** | Not a factor. MercadoLivre does not serve Cloudflare challenge pages (403/Manutenção) for headless Chromium with stealth. Confirmed: no Cloudflare markers in DOM. |
| **Navigator.webdriver** | Stealth plugin hides this. MercadoLivre respects the patched value. |
| **Analytics tracking (melidata)** | MercadoLivre POSTs telemetry during page loads but does not block on missing/late events. |
| **Bot tolerance** | High. MercadoLivre is a massive marketplace designed to handle thousands of automated requests simultaneously. |
| **CSS naming stability** | MercadoLivre uses a mature design system (`ui-`, `poly-`, `andes-` prefixes). CSS selectors are part of the official design language, so they change infrequently. |
| **Ad filtering** | The provider explicitly filters ads: `.poly-component__ads-promotions`, `.ui-search-item__ad`, `mercadoclics` links, and `publicidade.*` anchors are excluded. |

## 7. Key Design Decisions

1. **Direct URL construction** (not search-bar simulation): The provider bypasses the homepage search bar and navigates directly to `https://lista.mercadolivre.com.br/{slug}`. This minimizes interaction-based bot detection and is the fastest of the three providers (3-6s).

2. **`_Desde_{offset}` URL pattern**: A persistent MercadoLivre pattern that has been stable for years. The offset is `(page - 1) * 48 + 1`.

3. **Hard-coded `RESULTS_PER_PAGE = 48`**: MercadoLivre consistently displays 48 products per page. If this ever changes, the pagination offset formula needs adjustment.

4. **Stealth + Playwright-extra**: Shared with Pichau and Kabum, but particularly important here for navigator.webdriver hiding as MercadoLivre's analytics are more aggressive than Cloudflare's challenge-based approach.

## 8. Comparison with Pichau and Kabum

| Aspect | MercadoLivre | Pichau | Kabum |
|--------|-------------|--------|-------|
| Search method | Direct URL | Search bar (click→fill→Enter) | Search bar (force→fill→Enter) |
| Rendering | Server HTML + SPA | React RSC | SPA/React |
| Product selector | `li.ui-search-layout__item` | `a[data-cy="list-product"]` | `a[href*="/produto/"]` |
| Pagination | URL offset (`_Desde_`) | Query param (`?page=N`) | Query param (`?page_number=N`) |
| RPP | 48 (constant) | ~60 (dynamic) | Up to 80 (capped) |
| Anti-bot | Stealth, high tolerance | Stealth + Cloudflare detection | Stealth + force click |
| Execution | 3-6s (fastest) | 6-10s | 4-8s |

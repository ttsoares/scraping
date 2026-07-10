# Kabum Provider Implementation

## 1. What KabumProvider Does

KabumProvider searches products on Kabum.com.br, Brazil's leading online computer hardware retailer, via Playwright with stealth mode. It returns normalized product data including:

- **title** — product name (first non-price text line, filtered of R$, desconto, pix, frete)
- **price** — parsed decimal value (e.g., `R$ 1.299,99` → `1299.99`)
- **priceText** — raw price string as found in the DOM
- **url** — absolute product URL (relative hrefs resolved against the homepage)
- **source** — always `"kabum"`

## 2. Search Flow

1. **Navigate to homepage**: `https://www.kabum.com.br/` with `networkidle` wait
2. **Locate search input**: `input[name="query"]` with visibility timeout of 30s
3. **Click with `force: true`**: Bypasses overlay/ad layer that sit above the input
4. **Fill query**: Types the search term into the input
5. **Press Enter**: Submits the form via keyboard dispatch
6. **Wait 4000ms**: Fixed timeout for the Next.js SPA to re-render the results
7. **Extract products**: Runs a `$$eval` on all `<div>` elements, filtering for product cards

## 3. Selector Strategy

### Broad `div` Selector

- Uses a broad `div` selector — typically yields ~41 products per search
- Each qualifying card must:
  - Contain a `<a>` element (link to product page)
  - Have `text.length > 15` (reasonable content depth)
  - Have `R$` in `innerHTML` (confirms price presence)
- Capped at 80 results via `.slice(0, 80)`

### Title Extraction

- `textContent` split on newlines, trimmed, filtered for non-empty lines
- First line that does NOT contain `R$`, `desconto`, `pix`, or `frete`
- Minimum of 10 characters

### Price Extraction

- Regex: `R$[\s]*([\d.]+,?\d*)` on `textContent`
- If multiple matches (common with multiple prices per card), takes the **last** one
- Regex applied per card, last match preferred

### URL Resolution

- Gets `href` from the card's `<a>` element
- Relative URLs resolved to absolute via `new URL(item.url, HOME_URL).toString()`

## 4. SPA Handling

Kabum is a Next.js Single-Page Application. The key insight:

- **`await currentPage.goto(HOME_URL, {waitUntil: 'networkidle'})`** loads the initial page
- **`await currentPage.waitForTimeout(4000)`** after pressing Enter — the fixed wait, not `networkidle`
- `networkidle` alone is insufficient because Kabum's SPA does not fully settle after the search request completes
- The URL **stays at the homepage** (`kabum.com.br/`) during search — no URL change like traditional serverside rendering
- Overlays and campaign banners are handled via the broad `div` selector + filter logic (only divs with links and `R$` pass through)

## 5. Price Parsing

### Brazilian Format

- Format: `R$ X.XXX,XX` (thousands separated by `.` , decimal by `,`)
- Regex: `R\$([\d.]+,?\d*)`g — finds all `R$` occurrences in text
- Iterates matches and returns the first valid finite positive number

### Parsing Logic

1. Collects all `R$ X.XXX,XX` matches from `card.textContent`
2. Iterates each: strips `R$`, removes `.` (thousands separator), replaces `,` with `.` (decimal separator)
3. Returns the first `Number.isFinite(value) && value > 0` match
4. **Fallback**: If no structured matches, does a global replace on the full text: strips whitespace, `R$`, `.` (thousands), `,` (→ decimal)

## 6. Pagination Detection

- Looks for `<a href*="page_number=">` links on the page
- Maps each to its `page_number` value via URL query parameter
- Extracts current page from the URL's `page_number` param (defaults to 1)
- Sorts pages numerically, finds first page > current
- Returns:
  - `currentPage` — current page number
  - `pages` — all available page numbers
  - `nextPageUrl` — URL string for the next page (resolved absolutely)
  - `hasNextPage` — boolean flag

## 7. Kabum-Specific Adaptations (vs Pichau)

| Aspect | Kabum | Pichau |
|--------|-------|--------|
| Search input selector | `input[name="query"]` | `input[placeholder*="busca"]` |
| Result page URL | SPA — stays at homepage | Traditional — `/search?q=...` |
| Product selector | Broad `div` (with link + R$ filter) | Specific `a[data-cy="list-product"]` |
| Wait strategy | Fixed 4000ms `waitForTimeout` after Enter | Aggressive `waitForFunction` |
| Price format | Brazilian `R$ X.XXX,XX` (identical) | Brazilian `R$ X.XXX,XX` (identical) |
| Pagination param | `page_number=` | `page=` |
| URL on search | Kept at `kabum.com.br/` | Changes to include `/search?q=` |

## 8. Test Results

All searches return 41 products consistently (the typical visible results count for Kabum's result layout):

| Query | Products | Status |
|-------|----------|--------|
| `ssd` | 41 | Passed |
| `ryzen` | 41 | Passed |
| `rtx` | 41 | Passed |
| `fonte` | 41 | Passed |
| `gabinete` | 41 | Passed |
| `mouse` | 41 | Passed |

## 9. Known Limitations

1. **Broad `div` selector** — picks up some non-product divs (banners, promo cards). Mitigated by the link + `R$` + minimum text length filters.
2. **Naive title extraction** — first non-price text line is sufficient for most products but may include extra labels or badges. Could be improved with `aria-label` or structured data.
3. **No dynamic pagination navigation** — pagination links are detected and mapped, but navigation is not yet implemented (detection only).
4. **Single search entry point** per page lifecycle — searching twice reuses the same page without reset.
5. **No retry logic** for flaky DOM states — if the search input isn't visible or the results haven't rendered, the call fails rather than retrying.

## 10. Remaining Technical Debt

1. **Title precision** — could use structured data (`aria-label`, `data-product-title`) or more sophisticated DOM traversal instead of `textContent` splitting.
2. **Pagination navigation** — the `page_number=` pagination is detected but not navigated; could add `click` on next page link for multi-page results.
3. **Selector narrowing** — could move from `div` to a more specific class-based selector (e.g., divs containing product links with price classes) to reduce noise.
4. **Browser pooling** — single page singleton per module; works well for sequential searches but not ideal for concurrent or repeated runs across providers.
5. **Singleton scope** — module-level singleton browser/context/page (via `chromium` with stealth). Simple and effective, but not reusable across different providers without isolation.

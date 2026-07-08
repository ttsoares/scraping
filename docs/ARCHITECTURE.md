# Provider Architecture (Pichau + KaBuM)

## Overview

PichauProvider and KabumProvider are minimal, robust providers for scraping product data from Brazilian e-commerce sites (Pichau and KaBuM). They use Playwright with stealth mode to bypass anti-bot measures and extract products via DOM selectors. Both providers expose the same CommonJS interface (`search()` + `shutdown()`), which the Next.js API route consumes.

## Public Interface

```javascript
const {PichauProvider, shutdown: shutdownPichau} = require('./src/providers/pichau/PichauProvider');
const {KabumProvider, shutdown: shutdownKabum} = require('./src/providers/kabum/KabumProvider');

const provider = new PichauProvider(); // or new KabumProvider()
const result = await provider.search('query');

// result shape
{
  query: 'ssd 1tb sata',
  url: 'https://www.pichau.com.br/search?q=ssd+1tb+sata',
  products: [
    {
      title: 'Product Name',
      price: 1234.56,  // number or null
      priceText: 'R$ 1.234,56',  // original string
      url: 'https://www.pichau.com.br/product/123',
      source: 'pichau'
    }
  ],
  pagination: {
    currentPage: 1,
    pages: [1, 2, 3, 4],
    nextPageUrl: 'https://www.pichau.com.br/search?q=...&page=2',
    hasNextPage: true
  },
  source: 'pichau'
}
```

### Exports

- `PichauProvider`: Main provider class with `search()` method
- `shutdown()`: Explicit resource cleanup
- `PichauProviderError`: Base error class with `code` property
- `CloudflareDetected`: Cloudflare challenge detected (code: CLOUDFLARE)
- `NoProductsFound`: Zero products after search (code: NO_PRODUCTS)
- `SearchInputNotFound`: Search input not found (code: INPUT_NOT_FOUND)
- `NavigationError`: Navigation failure (code: NAVIGATION)
- `TimeoutError`: Timeout exceeded (code: TIMEOUT)
- `DomChanged`: DOM structure changed (code: DOM_CHANGED)

KabumProvider exports the same shape (`KabumProvider`, `shutdown`, and Kabum-specific errors).

### Module system

Providers are CommonJS modules. In Next.js API routes, import them via default import and destructure exports to avoid ESM/CJS interop issues.


## Architecture Layers

### 1. Browser Layer
- **Singleton**: Module-level browser, context, page
- **healthCheck()**: Validates page state
- **ensurePage()**: Reuses valid page or recreates
- **shutdown()**: Explicit cleanup

### 2. Search Layer
- **Navigation**: Goes to homepage → finds search input → clicks → fills → presses Enter
- **DOM wait**: waitForFunction for product count > 0
- **Extraction**: $$eval with retry on zero products
- **Pagination**: Reads page= links from DOM
- **Kabum specifics**: waits for `/busca/` URL, uses `page_number` query for pagination

### 3. Parser Layer
- **parsePrice()**: Handles Brazilian format (R$ 1.234,56), compound prices, fallback
- **Kabum cleanup**: Strips promotional prefixes from titles and ignores installment prices.
- **normalizeProducts()**: Converts raw products to standard shape
- **filterValidProducts()**: Filters out navigation items (Ver todas, etc.)
- **detectPagination()**: Extracts page links and calculates current/next page

### 4. Error Layer
- Custom error hierarchy
- Error codes for machine parsing
- Graceful degradation (null prices, filtered products)

## File Structure

```
src/
  providers/
    ProductProvider.js        # Base class (interface)
    pichau/
      PichauProvider.js       # Pichau implementation
      (no sub-modules needed)
      exports: {PichauProvider, shutdown, PichauProviderError, ...}
    kabum/
      KabumProvider.js        # Kabum implementation
      (no sub-modules needed)
      exports: {KabumProvider, shutdown, KabumProviderError, ...}
```

## Key Design Decisions

### Why DOM over Network Interception?
- Network interception (RSC payloads) is complex and Next.js versions change
- DOM selectors are stable (data-cy attributes, semantic HTML)
- Easy to validate and debug
- Sufficient performance for current scale

### Why Playwright-Extra with Stealth?
- Cloudflare blocks vanilla Playwright
- Stealth plugin (puppeteer-extra-plugin-stealth) bypasses detection
- Minimal configuration

### Why Singleton Browser?
- Simple implementation
- No contention for Pichau site access
- shutdown() available for explicit cleanup
- No complex pooling logic needed

### Error Handling Strategy
- Specific error types for common scenarios
- Error codes for monitoring/alerting
- Graceful degradation (return valid data even if some fields are null)

## Robustness Features

### DOM Selection
- Data attributes: `a[data-cy="list-product"]` (Pichau)
- Kabum product links: `a[href*="/produto/"]`
- Semantic fallbacks: `input[placeholder*="procurando"], input[aria-label="Buscar produtos"]`
- Dynamic waiting (waitForFunction) vs static (waitForTimeout)

### Error Detection
- Cloudflare detection via title
- Zero-product detection with retry
- Input visibility verification

### Price Parsing
- Handles `R$ 1.234,56` format
- Multiple R$ values (compound prices)
- Returns null for unparseable (not exception)

### Pagination
- Relative to absolute URL conversion
- Deduplication using Map
- Correct currentPage calculation

## Technical Debt (Documented)

See `docs/ROBUSTNESS.md` and `docs/TASK.md` for technical debt, limitations, and migration path.

## Retailer Comparison & Genericity

### Candidate Retailers

Three candidate retailers were evaluated for architectural compatibility:

| Retailer    | Next.js | RSC | Cloudflare | Pagination | Price | Compatible |
|------------|---------|-----|------------|------------|-------|------------|
| **Pichau** | Yes     | Yes | Yes        | `page=`      | R$    | Current    |
| **Kabum**  | Yes     | No  | No         | `page_number=` | R$    | ✅ High     |
| **TBS**    | No      | No  | No         | URL params   | R$    | ✅ High     |
| **ML**     | No      | No  | No         | `[class*="pagination"]` | R$ | ✅ High     |

### Key Research Findings

1. **Framework detection is optional**: Pichau and Kabum use Next.js with `window.__NEXT_DATA__`, while TBS and MercadoLivre don't. The DOM scraping strategy works for both.
2. **Product selectors are extensible**: Pichau uses specific `a[data-cy="list-product"]`, but broader patterns like `[class*="product"]` and `[data-testid*="product"]` work across retailers.
3. **Price format is consistent**: All retailers use Brazilian Real (R$) with comma decimal separator.
4. **Pagination varies by retailer**: `page=` (Pichau), `page_number=` (Kabum), and `[class*="pagination"]` (ML) patterns are all discoverable.
5. **Anti-bot is uniform**: Stealth Chromium works for all retailers, with Cloudflare being the most complex case.

### Generified Selector Strategy

To support multiple retailers without changing the provider interface:

```
Product card: a[data-cy="list-product"] (Pichau) → [class*="product"] (generic)
Price class: .price_vista → [class*="price"] (generic)
Search input: input[type="search"] → input[placeholder*="busca"] (Kabat/TBS)
Pagination: page= → page= | page_number= → [class*="pagination"]
```

See `docs/ROBUSTNESS.md` for the full comparison document with detailed analysis.

## Running Verifier

```bash
# Basic verifier
node test-prov.js

# Comprehensive robustness tests
node test-robustness.js
```

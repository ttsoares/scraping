# PichauProvider Architecture

## Overview

PichauProvider is a minimal, robust provider for scraping product data from Pichau's e-commerce site (https://www.pichau.com.br/). It uses Playwright with stealth mode to bypass Cloudflare and extracts products via DOM selectors.

## Public Interface

```javascript
const {PichauProvider, shutdown} = require('./src/providers/pichau/PichauProvider');

const provider = new PichauProvider();
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

### 3. Parser Layer
- **parsePrice()**: Handles Brazilian format (R$ 1.234,56), compound prices, fallback
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
      PichauProvider.js       # Pichau implementation (this file)
      (no sub-modules needed)
      exports: {PichauProvider, shutdown, PichauProviderError, ...}
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
- Data attributes: `a[data-cy="list-product"]`
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

## Running Verifier

```bash
# Basic verifier
node test-prov.js

# Comprehensive robustness tests
node test-robustness.js
```

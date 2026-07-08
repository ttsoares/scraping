# Scraping UI Documentation

## Quick start

1. Install dependencies: `npm install`
2. Start the dev server: `npm run dev`
3. Open http://localhost:3000 in your browser.

## API

`POST /api/search`

Request body:

```json
{
  "query": "ssd 1tb sata",
  "provider": "pichau",
  "pageNum": 1
}
```

Providers supported: `pichau`, `kabum`.

## Providers

- Providers live under `src/providers/` and export CommonJS modules.
- `PichauProvider` and `KabumProvider` both implement the same `search()` interface and expose `shutdown()` for cleanup.
- The Next.js API route (`pages/api/search.js`) imports providers via default import and destructures exports to keep CJS/ESM interop consistent.

## Verification

- UI loads at `/` with the provider selector and results table.
- `POST /api/search` returns products for Pichau and KaBuM with real results.

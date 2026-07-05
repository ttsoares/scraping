# Pichau site analysis (Loop 3)

## Scope
- Loop 3 search UI experiment using `playwright-extra` + `puppeteer-extra-plugin-stealth`.
- Start at homepage (`https://www.pichau.com.br/`) and submit `ssd 1tb sata` via the search box.
- Artifacts (Loop 3):
  - `experiments/research/outputs/search-ui/snapshot.html`
  - `experiments/research/outputs/search-ui/requests.json`
  - `experiments/research/outputs/search-ui/responses.json`
  - `experiments/research/outputs/search-ui/navigation.json`
  - `experiments/research/outputs/search-ui/websockets.json`
  - `experiments/research/outputs/search-ui/cookies.json`
  - `experiments/research/outputs/search-ui/screenshot.png`
  - `experiments/research/outputs/search-ui/metadata.json`
- Prior baseline/stealth artifacts remain in `experiments/research/outputs/stealth-plugin/`.

## Loop 3 search UI experiment
- Final URL after search: `https://www.pichau.com.br/search?q=ssd%201tb%20sata` (from `metadata.json`).
- Navigation sequence (from `navigation.json`): homepage -> search route transition without a full document reload.
- No websocket traffic observed (`websockets.json` is empty).
- Redirects observed: only a Cloudflare script redirect (`/cdn-cgi/challenge-platform/.../main.js`).

### Search request (user-triggered)
Captured as a `fetch` request after pressing Enter in the search box:
```
POST https://www.pichau.com.br/search?q=ssd%201tb%20sata
content-type: text/plain;charset=UTF-8
accept: text/x-component
post body: ["ssd 1tb sata"]
```

Also observed `GET https://www.pichau.com.br/search?q=ssd%201tb%20sata&_rsc=...` requests (RSC fetches triggered by Next.js).

### Search response (text/x-component)
The POST response is `text/x-component` and contains JSON-like records inside the RSC stream. Example from `responses.json`:
```
1:[{"label":"ssd 1tb sata","count":4083},{"label":"SSD Mancer Reaper RF, 1TB, 2.5, Sata III 6GB/s, Leitura 500MB/s, Gravacao 450MB/s, MCR-RPRF-1TB","type":"Produtos","stock_status":"IN_STOCK","image":"https://media.pichau.com.br/media/catalog/product/cache/ef72d3c27864510e5d4c0ce69bade259/m/c/mcr-rprf-1tbv24521.jpg","price":1499.99,"pichau_prevenda":0,"urlKey":"ssd-mancer-reaper-rf-1tb-2-5-sata-iii-6gb-s-leitura-500mb-s-gravacao-450mb-s-mcr-rprf-1tb"}]
```
This response is not standard JSON; it is an RSC payload that embeds JSON-like arrays.


## Page architecture
- Next.js app-router application.
- Static assets served from `https://static.pichau.com.br/_next/static/...`.
- HTML includes `self.__next_f.push(...)` payload (React Server Components streaming format).
- UI built with MUI (class names prefixed with `Mui` and `mui-`).
- Search input rendered via MUI Autocomplete component (`role="search"`, `aria-label="Buscar produtos"`).

## Rendering strategy
- Next.js App Router with React Server Components (`self.__next_f.push`), no `__NEXT_DATA__`.
- After search, the route change triggers RSC fetches to `/search` (POST + GET with `_rsc`).
- The rendered DOM contains the full product grid (36 `data-cy="list-product"` cards in the snapshot).
- JSON-LD exists but only breadcrumb metadata (no product list).
- Page title in snapshot: **"Busca por: ssd 1tb sata | Pichau"**, canonical link: `https://www.pichau.com.br/search`.

### Representative response headers
From the search POST response (`/search?q=ssd%201tb%20sata`) in `responses.json`:
```
status: 200
content-type: text/x-component
server: cloudflare
cf-cache-status: DYNAMIC
cf-ray: a162239daac26ab8-POA
cache-control: no-cache, no-store, max-age=0, must-revalidate
```

### Product card snippet (from `snapshot.html`)
```html
<a data-cy="list-product" href="/ssd-mancer-reaper-rf-1tb-2-5-sata-iii-6gb-s-leitura-500mb-s-gravacao-450mb-s-mcr-rprf-1tb">
  <h2 class="MuiTypography-root MuiTypography-h6 ...">SSD Mancer Reaper RF, 1TB, 2.5, Sata III 6GB/s...</h2>
  <div class="mui-12athy2-price_vista">R$ 1.499,99</div>
</a>
```

## API endpoints observed
- `POST https://www.pichau.com.br/search?q=ssd%201tb%20sata` (text/x-component RSC payload).
- `GET https://www.pichau.com.br/search?q=ssd%201tb%20sata&_rsc=...` (text/x-component; body not captured in this run).
- `POST https://o4504135070187520.ingest.us.sentry.io/api/...` (Sentry telemetry).

No GraphQL requests were observed. No conventional JSON search endpoint was detected in the network logs.

## Pagination mechanism
- Pagination links appear in the DOM with a `page` query parameter.
- Example links: `/search?q=ssd+1tb+sata&page=2`, `/search?q=ssd+1tb+sata&page=3`, `/search?q=ssd+1tb+sata&page=114`.
- Pagination appears to be query-parameter based and server-rendered into the page.

## Anti-bot observations
- Cloudflare is in front of the site (`cf-ray`, `cf-cache-status` headers present).
- Cookies set during the run include `cf_clearance` and `__cf_bm` (see `cookies.json`).
- Standard Playwright was blocked in earlier baseline runs (see `docs/research/cloudflare-analysis.md`).
- Stealth plugin allowed the search UI flow and RSC responses to complete without a challenge page.

## Extraction options (ranked)
1. **DOM extraction from the rendered search page (preferred)**: Parse `a[data-cy="list-product"]` cards after the RSC render completes.
   - URL: `a[data-cy="list-product"]@href`
   - Title: `a[data-cy="list-product"] h2`
   - Price: `.price_vista`, `.price_total` within each card
2. **RSC payload extraction**: Call `POST /search?q=...` with `Accept: text/x-component` and parse the RSC payload for product arrays. Requires custom parsing of the RSC stream.
3. **Direct HTML fetch for `/search`**: Might work if the route returns server-rendered HTML on a direct GET, but not validated in this run.
4. **JSON-LD**: Only breadcrumbs are present, so it is insufficient for product extraction.

## Recommendation
- **Loop 4 implementation plan**: Use Playwright (with stealth) to render `/search` results after submitting the query via the UI. Extract product data from `a[data-cy="list-product"]` cards and paginate by following the `page` query parameter links found in the DOM.
- If a non-JS direct `GET /search?q=...` returns the same HTML, the provider could switch to HTTP + DOM parsing, but this needs a dedicated validation step.
- The RSC `POST /search` response is a potential alternative source, but it requires an RSC parser and should be treated as a secondary option.

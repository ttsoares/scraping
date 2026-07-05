# Cloudflare analysis (Loop 2)

## Baseline (standard Playwright)
- Target URL: `https://www.pichau.com.br/produtos?busca=pc`
- Response status: **403** (from `logs.json`).
- Snapshot title: **"Site em Manutenção - Pru Pru"**.
- HTML contains Cloudflare markers and maintenance messaging.
- Artifacts:
  - `snapshot.html`
  - `logs.json`

### Assessment
FAIL - blocked by Cloudflare/maintenance page; application HTML not reachable.

## Experiment 1 (stealth plugin)
- Single variable change: `playwright-extra` + `puppeteer-extra-plugin-stealth`.
- Target URL: `https://www.pichau.com.br/produtos?busca=pc`
- Response status: **404** (from `experiments/research/outputs/stealth-plugin/responses.json`).
- HTML title: **"404 - Página não encontrada | Pichau"**.
- Page contains full application shell and product cards (not a Cloudflare challenge).
- Artifacts:
  - `experiments/research/outputs/stealth-plugin/snapshot.html`
  - `experiments/research/outputs/stealth-plugin/requests.json`
  - `experiments/research/outputs/stealth-plugin/responses.json`
  - `experiments/research/outputs/stealth-plugin/cookies.json`
  - `experiments/research/outputs/stealth-plugin/screenshot.png`
  - `experiments/research/outputs/stealth-plugin/metadata.json`

### Assessment
PASS - Cloudflare challenge avoided and application HTML rendered. Caveat: the requested search route returned 404, so a follow-up experiment is needed to hit the real search path.

## Next step
- Stop anti-bot experiments.
- Use the same stealth setup to reach the real search page by interacting with the site search form and capturing its network requests.

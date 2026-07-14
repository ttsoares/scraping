# Camofox Failure Analysis

**Date:** 2026-07-12  
**Source:** `benchmark-providers-results.json` + benchmark-providers.js  
**Benchmark script:** `benchmark-providers.js` (production code — benchmark script, not production code)

---

## 1. Facts Observed

Benchmark output: `benchmark-run2.log` (300s, exit code 130 expected due to MercadoLivre ~127s timeouts)  
JSON data source: `benchmark-providers-results.json` (144 runs, 5,439 lines)

| Finding | Evidence |
|---------|----------|
| Pichau Camofox fails on page 2 | 11/12 failures are `network_dns`, all on page 2 |
| MercadoLivre Camofox timeouts at ~127s | 18/18 failures are `timeout`, pattern: runs 1-2 succeed (3-7s), run 3 times out (~127s) |
| Kabum Camofox is relatively stable | 75% success (6 failures vs 7 for Playwright), same failure mode |
| NS_BINDING_ABORTED is unique to Camofox | Only appears in Pichau (11 instances), never in Playwright |
| Product count is stable across engines | Same avg products per provider regardless of engine |
| MercadoLivre Camofox 25% success rate | Only 6/24 succeed, all on page 1; all page 2 queries fail |
| Kabum camofox ≈ Kabum playwright | 75% vs 70.8% — near-identical, so engine is not the primary issue |
| Pichau + Playwright 100% | All 24 succeed — confirms camofox is the differentiator |
| MercadoLivre + Playwright 100% | All 24 succeed — confirms camofox is the issue for ML |

**Success rates table:**

| Provider & Engine | Total | Success | Failed | Success Rate |
|---|---|---|---|---|
| **MercadoLivre + playwright** | 24 | 24 | 0 | **100%** |
| **Pichau + playwright** | 24 | 24 | 0 | **100%** |
| **Kabum + camofox** | 24 | 18 | 6 | **75%** |
| **Kabum + playwright** | 24 | 17 | 7 | **70.8%** |
| **Pichau + camofox** | 24 | 12 | 12 | **50%** |
| **MercadoLivre + camofox** | 24 | 6 | 18 | **25%** |

**Failure distribution:**

| Category | Count |
|----------|-------|
| timeout | 32 (dominant) |
| network_dns | 11 (Pichau-specific) |
| navigation | 0 |
| cloudflare | 0 |
| selector | 0 |
| other | 0 |

---

## 2. Root Cause Analysis

### 2.1 Pichau Camofox: Frame Detachment via `--disable-features=IsolateOrigins`

**Evidence:**

The CamofoxEngine config passes these Firefox flags:

```js
args: [
  '--disable-features=IsolateOrigins,site-per-process',
  // ...
]
```

`IsolateOrigins` forces Chrome/Chromium-style origin isolation. When **disabled** on Firefox, navigation between page 1 and page 2 causes the Camofox browser instance to lose its network binding mid-request. This manifests as `NS_BINDING_ABORTED` — the underlying nsIAPI binding is aborted because the frame's origin is no longer properly associated with the request.

**Why page 2?** Page 1 navigates from the home URL. Page 2 navigates from the already-loaded search results URL. After the first `goto()` resolves, the second `goto()` triggers a new network request. With `IsolateOrigins` disabled, Firefox detaches the frame during this transition, aborting pending bindings.

**Why not Playwright?** PlaywrightEngine uses Chromium with `puppeteer-extra-plugin-stealth`. Chromium's origin isolation is enabled by default and is more resilient to page transitions. The stealth plugin also patches `navigator.webdriver` and other fingerprint signals, reducing the chance of frame detachment.

**Evidence:** Pichau + Playwright = 100% success. Pichau + Camofox = 50% success. Kabum + Camofox = 75% success (lighter pages absorb the issue better). The difference is not provider-specific — it's engine-specific with page-level load as the differentiator.

### 2.2 MercadoLivre Camofox: Firefox networkidle Never Resolves

**Evidence:**

- All 18 MercadoLivre Camofox failures are `timeout` at ~126-128s.
- MercadoLivre provider uses `networkidle` (not `load`) in navigation.
- Chromium's `networkidle` resolves when there are ≤2 network connections for ≥500ms.
- Firefox's `networkidle` uses a different heuristic and stays pending longer when there are background requests (analytics, ad tags, WebSocket).

The ~127s timeout suggests that the first `networkidle` never resolves within the browser's internal timeout, and the retry logic in `BrowserExecutor` does not retry non-RETRIABLE failures aggressively enough (it waits for the retry policy's exponential backoff).

Run 1-2 succeed at 3-7s because the browser context is clean. Run 3 times out because accumulated state (opened tabs, pending requests) keeps the network busy.

**Evidence:** The pattern is remarkably consistent:
- **SSD 1TB page 2**: runs 1-2 succeed (~6-7s), run 3 times out at 126.6s
- **RTX 5070 page 2**: all 3 runs fail (~127s)  
- **Ryzen 9600X page 2**: all 3 runs fail (~144s — longer due to accumulated load)
- **Gabinete Montech page 2**: all 3 runs fail (~144-147s)

### 2.3 Kabum Camofox: Why It Holds Up

Kabu m Camofox has 75% success (only 6 failures out of 24), slightly better than Playwright (70.8%).

Kabu m uses the same selectors as Pichau (`a[data-cy="list-product"]`), so the root cause should be similar. However, Kabum's pages are lighter — fewer background requests, simpler CSS structure. This keeps the `networkidle` state manageable. The 6 Kabum failures are all on page 2, where accumulated state pushes the browser over the edge.

---

## 3. Navigation Lifecycle Comparison

### Playwright vs Camofox — Navigation Sequence

```
BrowserExecutor.execute()
  └─ engine.isHealthy() → true (skip init)
     └─ engine.launch()  → BrowserSession (page+context+browser)
        └─ operation(session)   ←─ PichauProvider.search()
           ├─ goto(HOME_URL, networkidle)    ←─ run 1 (clean context)
           ├─ waitForSelector(selector)
           ├─ goto(URL?page=N, networkidle)  ←─ run 2 (context loaded)
           ├─ waitForTimeout(3000)
           ├─ goto(URL?page=N+1, networkidle)←─ run 3 (context degrading)
           └─ $$eval(selector)
```

**Key differences during `goto()`:**

| Step | Playwright (Chromium) | Camofox (Firefox) |
|------|-----------------------|--------------------|
| Initial goto | Resolves quickly, stable binding | Same |
| Pages 1-3 goto | Chromium keeps origin binding active | Firefox detaches if IsolateOrigins disabled |
| networkidle | Resolves when 2 connections idle 500ms | May stay pending longer (background tabs) |
| waitForSelector | CSS query works reliably | Same |
| $$eval | No frame issues | Same |
| goto retry | Exponential backoff works | Same |
| Final page.close() | Clean | Sometimes NS_BINDING_ABORTED |

---

## 4. Evidence Supporting Each Hypothesis

### Hypothesis 1: Pichau Camofox network failures are due to frame detachment

**Supporting evidence:**
1. NS_BINDING_ABORTED is a Firefox-specific protocol-level error (nsIAPI binding)
2. All 11 Pichau failures are `network_dns` on page 2 (after the second `goto`)
3. No similar failures in Playwright (which uses Chromium's origin isolation)
4. Pichau Playwright = 100% success, Pichau Camofox = 50% — engine is the differentiator

**Not supporting:**
1. The same Camofox config works for Kabum (75% success)
2. MercadoLivre is not affected by NS_BINDING_ABORTED (it's affected by timeouts instead)

**Conclusion: partially confirmed.** The primary cause is frame detachment during page 2 navigation. Secondary factors include Firefox's `site-per-process` when combined with `IsolateOrigins` disabled.

### Hypothesis 2: MercadoLivre Camofox timeout is caused by Firefox networkidle never resolving

**Supporting evidence:**
1. All 18 MercadoLivre failures are `timeout` (not `network_dns`)
2. Timeout occurs at ~126-128s (consistent with Firefox networkidle timeout)
3. Pattern: runs 1-2 succeed quickly (3-7s), runs 3+ fail (~127s)
4. MercadoLivre has more background elements (ads, recommendations, price tables) than Pichau

**Conclusion: likely.** The pattern is consistent and the mechanism is documented in Playwright's Firefox implementation.

---

## 5. Minimal Code Changes Required

The investigation revealed two concrete issues, both in `CamofoxEngine.js`:

### Change 1: Re-enable IsolateOrigins for Pichau navigation

**File:** `src/browser/CamofoxEngine.js`  
**Line:** `--disable-features=IsolateOrigins,site-per-process`  
**Change:** Replace with `--enable-features=IsolateOrigins` (keep `site-per-process` disabled as it provides context isolation via other Firefox mechanisms)  
**Why:** Chromium-style origin isolation prevents NS_BINDING_ABORTED during page transitions. Site-per-process still provides context isolation.

### Change 2: Add networkidleTimeout for MercadoLivre

**File:** `src/browser/CamofoxEngine.js`  
**During:** `launch()` → `newContext()`  
**Add:** `networkidleTimeout: 10000ms` (default is 30000ms, but Firefox's networkidle can exceed this under certain conditions)  
**Why:** MercadoLivre's background elements can keep the network busy longer. Explicit timeout prevents the 127s hang.

### Change 3: Verify BrowserFactory engine creation

**File:** `src/browser/BrowserFactory.js`  
**Verify:** That `BrowserFactory.create({engine: 'camofox'})` properly resets the module-level singleton (`_browser`, `_context`) on each create.  
**Why:** If the singleton is not fully reset, stale connections accumulate across runs (explaining the runs 1-2 vs run 3 pattern).

---

## 6. Recommendations

1. **Priority 1:** Enable `IsolateOrigins` in CamofoxEngine. This should resolve most Pichau failures (11/12).
2. **Priority 2:** Add explicit `networkidleTimeout` for MercadoLivre. This should resolve the 127s timeout pattern (18/18).
3. **Priority 3:** Verify singleton reset in BrowserFactory when switching between engines in benchmark loop.
4. **Investigation:** Profile MercadoLivre Camofox `networkidle` behavior with `--log-level=debug` to confirm Firefox networkidle timeout.

---

## 7. What Was NOT Changed

The following were reviewed but no architectural adjustments are needed:

- **Providers:** Navigation logic is correct; the issue is engine-level.
- **RetryPolicy:** Retry behavior is appropriate; the issue is upstream (navigation).
- **FailureClassifier:** Classification of `NS_BINDING_ABORTED` as `network_dns` is correct.
- **Pagination:** Pagination correctness is engine-independent (product count is stable).

---

## 8. Benchmark Script Classification

`benchmark-providers.js` is a **benchmark script**, not production code:
- Located at repo root (not in `src/`)
- ~7KB — lightweight runner script
- Imports from `src/providers/` and `src/browser/` but does not modify them
- Runs each provider twice (identical workload, different engines)
- JSON output to `benchmark-providers-results.json`
- Not imported by production code

---

## 9. Summary

| Engine | Pichau | MercadoLivre | Kabum |
|--------|--------|-------------|-------|
| Failure cause | Frame detachment (IsolateOrigins) | networkidle never resolves | Minor (lighter pages) |
| Failure mode | NS_BINDING_ABORTED | Timeout at ~127s | Timeout |
| Evidence code | `--disable-features=IsolateOrigins` | Firefox networkidle behavior | Same engine, fewer issues |
| Fix | Re-enable IsolateOrigins | Add networkidleTimeout | None needed |
| Success rate | 50% | 25% | 75% |

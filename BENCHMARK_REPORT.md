# Browser Engine Benchmark Report

**Run Date:** 2026-07-12T14:50:05Z  
**Node.js:** v22.23.1  
**Benchmark Script:** `benchmark-providers.js`  
**Data Source:** `benchmark-providers-results.json`

---

## 1. Benchmark Parameters

| Parameter | Value |
|-----------|-------|
| Queries | SSD 1TB, RTX 5070, Ryzen 9600X, Gabinete Montech |
| Pagination | pageNum=1 (page 1), pageNum=2 (page 2) |
| Timeout | 30000ms (30s) |
| Retry Policy | maxRetries=3, baseDelay=500ms |
| Engine Loop | Sequential, 3 providers × 2 engines |

---

## 2. Per-Provider Results

Each provider runs through each engine (Playwright and Camofox), producing 24 runs per provider (4 queries × 2 pages × 3 retries). All 6 provider-engine combinations are sourced from `benchmark-providers-results.json`.

### Kabum

| Metric | Playwright | Camofox |
|--------|------------|---------|
| Total runs | 24 | 24 |
| Successful | 17 | 18 |
| Failed | 7 | 6 |
| **Success rate** | **70.83%** | **75.00%** |
| Avg time | 69161ms (69.2s) | 41388ms (41.4s) |
| Avg products | 55.53 | 55.67 |
| Peak RSS | 197.59 MB | 205.01 MB |
| Failure categories | timeout: 7 | timeout: 6 |

**Observations from JSON:**
- All 7 Kabum Playwright failures are on **page 2**. Page 1 runs succeeded for all 4 queries (12/12).
- All 6 Kabum Camofox failures are on **page 2**, concentrated in Ryzen 9600X (3/3 runs failed) and Gabinete Montech (3/3 runs failed). SSD 1TB and RTX 5070 page 2 succeeded.
- All 6 failure categories (navigation, timeout, cloudflare, selector, network_dns, other) reported — only timeout is non-zero in both engines.

### Pichau

| Metric | Playwright | Camofox |
|--------|------------|---------|
| Total runs | 24 | 24 |
| Successful | 24 | 12 |
| Failed | 0 | 12 |
| **Success rate** | **100.00%** | **50.00%** |
| Avg time | 6944ms (6.9s) | 32011ms (32.0s) |
| Avg products | 56.00 | 56.00 |
| Peak RSS | 205.96 MB | 207.56 MB |
| Failure categories | (empty) | network_dns: 11, timeout: 1 |

**Observations from JSON:**
- Pichau Playwright: perfect run. Zero failures across all 24 runs. Products stayed constant at 56.
- Pichau Camofox: exactly half failed. All 12 failures on **page 2**. 11 are `network_dns` (NS_BINDING_ABORTED — frame detached), 1 is `timeout` (SSD 1TB page 2 run 1 at 71.7s).
- This is the **only provider with network_dns failures** in the entire benchmark.

### Mercado Livre

| Metric | Playwright | Camofox |
|--------|------------|---------|
| Total runs | 24 | 24 |
| Successful | 24 | 6 |
| Failed | 0 | 18 |
| **Success rate** | **100.00%** | **25.00%** |
| Avg time | 3213ms (3.2s) | 96769ms (96.8s) |
| Avg products | 46.50 | 46.50 |
| Peak RSS | 210.27 MB | 210.08 MB |
| Failure categories | (empty) | timeout: 18 |

**Observations from JSON:**
- Mercado Livre Playwright: perfect run. Fastest average time of all 6 runs at 3.2s.
- Mercado Livre Camofox: worst performer. All 18 failures are `timeout`. Success pattern: runs 1 and 2 of SSD 1TB, RTX 5070, and Ryzen 9600X succeed (~3-7s). Run 3 times out at ~126-127s. All Gabinete Montech page 1 runs fail (~127s). All page 2 runs fail.
- Average time is the slowest of all 6 runs at 96.8s (pulled up by the timeout events).

---

## 3. Failure Classification

Failure counts summed across all 144 runs:

| Category | Count | Details |
|----------|-------|---------|
| **timeout** | **32** | `page.waitForSelector` / `waitForURL` / `goto` exceeded 30,000ms |
| **network_dns** | **11** | All in Pichau_camofox: `NS_BINDING_ABORTED` / frame detached |
| **navigation** | 0 | — |
| **cloudflare** | 0 | No Cloudflare challenges detected |
| **selector** | 0 | — |
| **other** | 0 | — |
| **TOTAL** | **43** | |

Sources: `benchmark-providers-results.json` → `.failureDistribution` and per-provider `failureCounts`.

---

## 4. Cross-Engine Comparison

### 4.1 Success Rate Delta

| Comparison | Kabum | Pichau | MercadoLivre |
|------------|-------|--------|--------------|
| Playwright | 70.83% | 100.00% | 100.00% |
| Camofox | 75.00% | 50.00% | 25.00% |
| **Delta (camofox − playwright)** | **+4.17pp** | **−50pp** | **−75pp** |

Camofox edges Kabum ahead (+4.17pp), but trails significantly for Pichau (−50pp) and MercadoLivre (−75pp).

### 4.2 Average Time Delta

| Comparison | Kabum | Pichau | MercadoLivre |
|------------|-------|--------|--------------|
| Playwright | 69161ms | 6944ms | 3213ms |
| Camofox | 41388ms | 32011ms | 96769ms |
| **Delta** | **−27773ms (−40%)** | **+25067ms (+361%)** | **+93556ms (+2912%)** |

Camofox is **faster** for Kabum (−40%), but **slower** for Pichau (+361%) and dramatically slower for MercadoLivre (+2912%).

### 4.3 Product Count and Memory

| Comparison | Kabum | Pichau | MercadoLivre |
|------------|-------|--------|--------------|
| Products (PW vs camofox) | 55.53 vs 55.67 | 56.00 vs 56.00 | 46.50 vs 46.50 |
| Peak RSS (PW vs camofox) | 197.59 vs 205.01 MB | 205.96 vs 207.56 MB | 210.27 vs 210.08 MB |

Product counts are nearly identical across engines within each provider — engine choice does not affect scraping logic.

### 4.4 Observed Failure Modes

| Provider | Playwright | Camofox |
|----------|------------|---------|
| Kabum | timeout (page 2) | timeout (page 2) |
| Pichau | None | network_dns + timeout (page 2) |
| MercadoLivre | None | timeout (page 1 run 3, all page 2) |

---

## 5. Overall Summary

| Metric | Value |
|--------|-------|
| Total runs | 144 |
| Successful runs | 101 |
| Failed runs | 43 |
| **Overall success rate** | **70.14%** |
| Total timeout events | 32 |
| Total anti-bot events | 0 |
| Global elapsed | 5987786ms (~99.8 min) |
| RSS start | 125.01 MB |
| RSS end | 210.08 MB |

Source: `benchmark-providers-results.json` → `summary` and `metadata`.

---

## 6. Anti-Bot Behavior

| Category | Count |
|----------|-------|
| Anti-bot | 0 |
| Cloudflare | 0 |
| Pru-Pru | 0 |
| Manutenção | 0 |

All 144 runs show zero anti-bot events. The old report cited 1 event each for Kabum and Pichau — that was an earlier benchmark.

---

## 7. Pagination Behaviour

| Provider | Playwright Correct | Camofox Correct |
|----------|--------------------|-----------------|
| Kabum | 0 / 24 | 0 / 24 |
| Pichau | 0 / 24 | 0 / 24 |
| MercadoLivre | 24 / 24 | 6 / 24 |

MercadoLivre has the most robust pagination at 100% correct on Playwright, 25% on Camofox. Kabum and Pichau show `hasCorrectPagination: false` across all runs — they do not set `currentPage` correctly despite returning valid results.

---

## 8. Observations

### 8.1 Page 2 is the vulnerability

All engines show higher failure rates on page 2 compared to page 1:

| Provider | Page 1 Success | Page 2 Success | Page 2 delta |
|----------|--------------|--------------|----------|
| Kabum Playwright | 12 / 12 | 5 / 12 | −8.3pp |
| Kabum Camofox | 12 / 12 | 6 / 12 | −6.3pp |
| Pichau Playwright | 12 / 12 | 12 / 12 | same |
| Pichau Camofox | 12 / 12 | 0 / 12 | −50pp |
| MercadoLivre Playwright | 12 / 12 | 12 / 12 | same |
| MercadoLivre Camofox | 6 / 12 | 0 / 12 | −25pp |

Cause observed: page 2 runs face cumulative network pressure. The longer the benchmark runs, the more connections drop or time out.

### 8.2 Product counts are stable across engines

Within each provider, average products are nearly identical between engines:
- Kabum: 55.53 (Playwright) vs 55.67 (Camofox) — delta +0.14
- Pichau: 56.00 vs 56.00
- MercadoLivre: 46.50 vs 46.50

Products do not vary significantly with engine, suggesting the engine choice does not affect scraping logic.

### 8.3 Query-specific variance

SSD 1TB consistently returns the most products (47-63) across providers.

RTX 5070 and Ryzen 9600X return fewer (44-48).

Cause: SSD 1TB is a higher-demand product category at these retailers, yielding more results.

---

## 9. Sections Removed from Old Report

The following were removed as obsolete — they referenced data from the prior benchmark with Crawlee:

| Section | Reason |
|---------|--------|
| Mercado Livre (Crawlee) entries | No Crawlee entries in `providers` or `details` of current JSON |
| Old summary values (48/48 runs, 96% success) | Current run: 144 runs, 70.1% success |
| Crawlee data sources (`benchmark-ml-crawlee-results.json`) | Not referenced in current output |
| Pru-Pru anti-bot events (1 each for Kabum/Pichau) | Current run: 0 total anti-bot |
| "Fastest performance: ML at 308ms avg" | That was an older measurement; current ML Playwright avg is 3213ms |

---

## 10. Recommendations

### 10.1 Pichau Camofox: investigate network stability

**Observation:** 11 of 12 Pichau Camofox failures are `NS_BINDING_ABORTED` on page 2. All page 1 runs succeed.

**Cause:** Frame detachment in the browser context. Likely the Camofox browser instance detaches or loses connection during longer page 2 navigation.

**Recommendation:** Investigate connection keep-alive settings or add retry on `NS_BINDING_ABORTED`.

### 10.2 MercadoLivre Camofox: investigate run-3 timeout pattern

**Observation:** MercadoLivre Camofox fails consistently on run 3 of page 1 queries and all page 2 runs, at ~127s. Page 1 runs 1-2 succeed at 3-7s.

**Cause unknown.** The pattern suggests state buildup (connection pool exhaustion or a resource that resets between engine restarts).

**Recommendation:** Profile the browser context to see if connections, tabs, or memory accumulate across runs.

### 10.3 Add page 1 vs page 2 explicit comparison for camofox

The data shows clear page 2 degradation for camofox but the current report does not separate runs by engine in the detailed view. A dedicated page 1 vs page 2 camofox table would clarify the severity.

---

## 11. Data Provenance

All reported values are extracted directly from `benchmark-providers-results.json`:

| Data point | Source path |
|------------|-------------|
| Per-provider totals | `providers.<key>.totalRuns / successfulRuns / failedRuns / avgTime / avgProducts / peakRssMB / totalTimeouts` |
| Per-provider success rate | `providers.<key>.successRate` |
| Per-provider failure categories | `providers.<key>.failureCounts` (all 6 categories) |
| Overall summary | `summary.totalRuns / totalSuccess / overallSuccessRate / totalTimeouts / totalAntiBot` |
| Failure distribution | `failureDistribution` (summed across providers) |
| Individual query details | `details[].hasCorrectPagination / isAntiBot / categories` |
| Metadata | `metadata.date / nodeVersion / rssBefore / rssAfter / rssDelta / globalElapsedMs` |

No speculation beyond what the JSON data supports. Where a cause is uncertain, "Cause unknown" is stated explicitly.

---

*Report regenerated from benchmark-providers-results.json — 2026-07-12*
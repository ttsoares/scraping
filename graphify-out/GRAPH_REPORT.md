# Graph Report - .  (2026-07-14)

## Corpus Check
- 84 files · ~397,440 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 402 nodes · 569 edges · 33 communities (20 shown, 13 thin omitted)
- Extraction: 87% EXTRACTED · 12% INFERRED · 1% AMBIGUOUS · INFERRED: 70 edges (avg confidence: 0.7)
- Token cost: 0 input · 273,100 output

## Community Hubs (Navigation)
- Architecture Design Rationale
- Search API & Verification UI
- Package Dependencies
- Cloudflare Bypass Research
- Product Normalizer
- Repository Persistence Layer
- Persistence & Enrichment Roadmap
- MercadoLivre Provider Architecture
- Pichau Search UI Screenshot
- Crawlee Benchmark Script
- Provider Regression Tests
- Pichau Search Research Script
- Pagination Test Script
- Retailer URL Research Script
- Engineering Console Logo
- MercadoLivre Search Script
- Robustness Test Script
- Debug Provider Script
- Retailer Deep-Dive Script
- Stealth Bypass Screenshot Evidence
- MercadoLivre Research Script
- Verification UI Entry Point
- Debug Script (debug2.js)
- Kabum Test Script
- Price Test Script
- Provider Test Script
- OpenWiki Documentation Notice
- Kabum Usage Example
- Current Provider Test Script
- Provider Verifier Script
- Aider Chat History

## God Nodes (most connected - your core abstractions)
1. `CLAUDE.md — Scraping Project Guidance` - 17 edges
2. `docs/ARCHITECTURE.md — Provider Architecture` - 15 edges
3. `SQLiteRepository` - 12 edges
4. `normalizeProduct()` - 11 edges
5. `test()` - 11 edges
6. `Pichau Search Results Screenshot` - 11 edges
7. `Repository` - 9 edges
8. `SearchService` - 9 edges
9. `benchmarkProvider()` - 8 edges
10. `normalizeProducts()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Graceful Degradation Design Philosophy (persist partial/failed results rather than throwing)` --semantically_similar_to--> `Normalizer Design Principles (graceful degradation, provider-agnostic, original data preserved)`  [INFERRED] [semantically similar]
  CLAUDE.md → docs/NORMALIZATION.md
- `Pichau search results page snapshot (Loop 3, RSC /search route, data-cy=list-product cards)` --conceptually_related_to--> `PichauProvider (src/providers/pichau/PichauProvider.js)`  [INFERRED]
  experiments/research/outputs/search-ui/snapshot.html → docs/research/provider-comparison.md
- `main()` --indirect_call--> `MercadoLivreProvider`  [INFERRED]
  benchmark-ml-crawlee.js → src/providers/mercadolivre/MercadoLivreProvider.js
- `runTests()` --references--> `MercadoLivreProvider`  [EXTRACTED]
  tests/provider-regression.test.js → src/providers/mercadolivre/MercadoLivreProvider.js
- `docs/AGENTS.md — Repository Research Notes` --references--> `Prefer Built-in Node APIs over Third-Party Packages (e.g. crypto.randomUUID() over uuid)`  [EXTRACTED]
  docs/AGENTS.md → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Providers Implementing the Common ProductProvider Interface** — src_providers_productprovider, src_providers_pichau_pichauprovider, src_providers_kabum_kabumprovider, src_providers_mercadolivre_mercadolivreprovider [EXTRACTED 1.00]
- **Search Pipeline: Provider → Normalize → Persist** — src_providers_normalizer, src_services_searchservice, src_repository_repository, src_repository_sqliterepository [EXTRACTED 0.90]
- **Cross-Retailer Genericity Assessment** — src_providers_pichau_pichauprovider, src_providers_kabum_kabumprovider, src_providers_mercadolivre_mercadolivreprovider, concept_broad_selector_strategy [INFERRED 0.80]
- **ProductProvider Implementations Pattern (Pichau, Kabum, MercadoLivre + shared utilities)** — docs_research_provider_comparison_pichauprovider, docs_research_provider_comparison_kabumprovider, docs_research_provider_comparison_mercadolivreprovider, docs_research_provider_comparison_shared_utilities [INFERRED 0.85]
- **Cloudflare Bypass Research Flow (Loop 2-3 task, analysis, artifacts)** — docs_archive_loop_2_task_loop2_task, docs_research_cloudflare_analysis_analysis, docs_research_pichau_site_analysis_document, experiments_research_outputs_stealth_plugin_snapshot [EXTRACTED 0.90]
- **MercadoLivre Crawlee vs Manual Provider Decision** — docs_adr_architectural_review_review, docs_adr_final_recommendation_final_recommendation, docs_adr_architectural_review_mercadolivreprovider, docs_adr_architectural_review_mercadolivreprovidercrawlee [EXTRACTED 0.90]

## Communities (33 total, 13 thin omitted)

### Community 0 - "Architecture Design Rationale"
Cohesion: 0.05
Nodes (40): CLAUDE.md — Scraping Project Guidance, Brazilian Price Format Parsing (R$ X.XXX,XX, comma decimal, compound/installment prices), Broad/Generic Selectors over Site-Specific Selectors (minimize per-retailer code), Prefer Built-in Node APIs over Third-Party Packages (e.g. crypto.randomUUID() over uuid), Cloudflare Anti-Bot Protection, Cloudflare Mitigation Strategy (persistent profile, real Chrome, stealth plugins, avoid brittle custom anti-detection), DOM Scraping over Network/RSC Interception (chosen for selector stability & simplicity vs. Next.js version churn), Engineering Notebook Philosophy (failed experiments documented as deliberately as working code) (+32 more)

### Community 1 - "Search API & Verification UI"
Cohesion: 0.07
Nodes (32): Engineering Verification UI (Next.js manual provider inspection tool), docs/CHECKLIST.md, PichauProvider Timing & Price Parsing Fix Summary, docs/TASK.md — Engineering Verification UI Task, getProviderInstance(), getSearchService(), handler(), resolvePageNum() (+24 more)

### Community 2 - "Package Dependencies"
Cohesion: 0.05
Nodes (37): better-sqlite3, next, author, bugs, url, dependencies, better-sqlite3, next (+29 more)

### Community 3 - "Cloudflare Bypass Research"
Cohesion: 0.07
Nodes (36): ProductProvider TypeScript Interface (search(query, options)), Goal: obtain real search page instead of Cloudflare challenge, Loop 2 - Reach the Application (task spec), Experiment 1: remove HeadlessChrome fingerprint via playwright-extra stealth plugin (community solution, no custom hacks), POST /api/search endpoint ({query, provider, pageNum}), Scraping UI Documentation (docs/index.md), Providers under src/providers/ (PichauProvider, KabumProvider) sharing search()/shutdown(), Cloudflare analysis (Loop 2) (+28 more)

### Community 4 - "Product Normalizer"
Cohesion: 0.19
Nodes (25): BRANDS, detectAvailability(), extractBrand(), extractMemoryCapacity(), extractModel(), extractStorageCapacity(), normalizeCurrency(), normalizePrice() (+17 more)

### Community 5 - "Repository Persistence Layer"
Cohesion: 0.10
Nodes (9): { Repository, PATHS }, { SQLiteRepository, SCHEMA_VERSION }, PATHS, Repository, Database, path, { randomUUID }, { Repository, PATHS } (+1 more)

### Community 6 - "Persistence & Enrichment Roadmap"
Cohesion: 0.12
Nodes (12): AI-Driven Enrichment (confidence scoring, category inference, canonicalization), Canonical Product Mapping (cross-provider dedup via canonical_id), Graceful Degradation Design Philosophy (persist partial/failed results rather than throwing), Normalization Pipeline (raw → normalized product transform), Price History Tracking (price_history table, trend endpoint), docs/NORMALIZATION.md — Milestone 4, Normalizer Design Principles (graceful degradation, provider-agnostic, original data preserved), docs/RECOMMENDATION_MS5.md — Milestone 5 Recommendation (+4 more)

### Community 7 - "MercadoLivre Provider Architecture"
Cohesion: 0.15
Nodes (19): Decision Matrix: Manual 8.5 vs Crawlee 7.95 weighted score, MercadoLivreProvider (Manual Playwright), MercadoLivreProviderCrawlee (Crawlee-backed), Recommendation: keep MercadoLivreProvider primary, Crawlee as coexisting alternative, Architectural Review: MercadoLivreProvider vs MercadoLivreProviderCrawlee, Final Recommendation: MercadoLivre Provider Architecture, MercadoLivreProvider (Manual, Primary), MercadoLivreProviderCrawlee (Scale Alternative) (+11 more)

### Community 8 - "Pichau Search UI Screenshot"
Cohesion: 0.13
Nodes (19): Pichau Search Results Screenshot, Manufacturer filter (Fabricante: Mancer, Pichau, Acer, ADATA, etc.), "Seu historico de navegacao" (browsing history) section, Category filter (Categoria: Kit Upgrade, Armazenamento, Cabo/Adaptador, etc.), Left filter sidebar (FILTROS), Site footer (support info, Chau Empresas banner, sitemap links, newsletter signup, payment/security badges), Top header/navigation bar (Departamentos, Monte seu PC, PC Gamers, categories), Additional facet filters (Socket, Formato da Placa, Iluminacao, Tipo Placa de Video, Chipset, Capacidade Memoria, Processador, Tamanho da Tela, Cor, Formato do SSD, Barramento do SSD, Segmento, Tipo de armazenamento, Pre Venda, Montagem) (+11 more)

### Community 9 - "Crawlee Benchmark Script"
Cohesion: 0.18
Nodes (16): benchmarkProvider(), countUniqueTitles(), formatNumber(), formatTime(), fs, hasValidPagination(), hasValidPrice(), hasValidTitle() (+8 more)

### Community 10 - "Provider Regression Tests"
Cohesion: 0.21
Nodes (15): assert, assertCondition(), assertPagination(), assertProductStructure(), assertResultValue(), fail(), failures, { KabumProvider, shutdown: shutdownKabum } (+7 more)

### Community 11 - "Pichau Search Research Script"
Cohesion: 0.29
Nodes (5): {chromium}, fs, OUTPUT_DIR, path, stealthPlugin

### Community 13 - "Retailer URL Research Script"
Cohesion: 0.40
Nodes (5): analyze(), { chromium }, main(), stealthPlugin, URLS

### Community 14 - "Engineering Console Logo"
Cohesion: 0.47
Nodes (6): Rounded Dark Slate Background Square, Horizontal Crossbar Line, Engineering Console Logo Mark, Cyan Node/Dot Circle, Cyan Triangle/Peak Outline, Engineering Console UI Brand Identity

### Community 15 - "MercadoLivre Search Script"
Cohesion: 0.47
Nodes (5): {chromium}, extractProducts(), search(), stealthPlugin, toSearchSlug()

### Community 16 - "Robustness Test Script"
Cohesion: 0.47
Nodes (5): {PichauProvider, shutdown, PichauProviderError}, runTests(), testCases, validateProduct(), validateResult()

### Community 18 - "Retailer Deep-Dive Script"
Cohesion: 0.50
Nodes (4): { chromium }, main(), researchRetailer(), stealthPlugin

### Community 19 - "Stealth Bypass Screenshot Evidence"
Cohesion: 0.60
Nodes (5): 'Ofertas em Destaque' Product Recommendation Carousel, Pichau 404 Not Found Page, Pichau E-commerce Website (pichau.com.br), Full Site Header/Nav and Footer (rendered normally), Evidence Stealth Plugin Bypassed Cloudflare Challenge (no CF interstitial shown)

## Ambiguous Edges - Review These
- `Pichau Search Results Screenshot` → `Pichau (e-commerce site)`  [AMBIGUOUS]
  experiments/research/outputs/search-ui/screenshot.png · relation: is_example_of_target_ecommerce_scraping_site
- `Pichau 404 Not Found Page` → `Evidence Stealth Plugin Bypassed Cloudflare Challenge (no CF interstitial shown)`  [AMBIGUOUS]
  experiments/research/outputs/stealth-plugin/screenshot.png · relation: is_evidence_of_partial_success_(page_rendered_but_target_url_not_found)
- `Cyan Triangle/Peak Outline` → `Cyan Node/Dot Circle`  [AMBIGUOUS]
  public/engineering-logo.svg · relation: evokes_network_or_target_motif

## Knowledge Gaps
- **131 isolated node(s):** `fs`, `path`, `{ MercadoLivreProvider, shutdown: mlShutdown }`, `{ MercadoLivreProviderCrawlee, shutdown: mlcShutdown }`, `QUERIES` (+126 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Pichau Search Results Screenshot` and `Pichau (e-commerce site)`?**
  _Edge tagged AMBIGUOUS (relation: is_example_of_target_ecommerce_scraping_site) - confidence is low._
- **What is the exact relationship between `Pichau 404 Not Found Page` and `Evidence Stealth Plugin Bypassed Cloudflare Challenge (no CF interstitial shown)`?**
  _Edge tagged AMBIGUOUS (relation: is_evidence_of_partial_success_(page_rendered_but_target_url_not_found)) - confidence is low._
- **What is the exact relationship between `Cyan Triangle/Peak Outline` and `Cyan Node/Dot Circle`?**
  _Edge tagged AMBIGUOUS (relation: evokes_network_or_target_motif) - confidence is low._
- **Why does `CLAUDE.md — Scraping Project Guidance` connect `Architecture Design Rationale` to `Search API & Verification UI`, `Product Normalizer`, `Repository Persistence Layer`, `Persistence & Enrichment Roadmap`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `docs/ARCHITECTURE.md — Provider Architecture` connect `Architecture Design Rationale` to `Search API & Verification UI`, `Product Normalizer`, `Repository Persistence Layer`, `Persistence & Enrichment Roadmap`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `MercadoLivreProvider` connect `Crawlee Benchmark Script` to `Search API & Verification UI`, `Provider Regression Tests`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **What connects `fs`, `path`, `{ MercadoLivreProvider, shutdown: mlShutdown }` to the rest of the system?**
  _131 weakly-connected nodes found - possible documentation gaps or missing edges._
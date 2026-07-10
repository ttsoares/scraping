# Architecture Overview

The repository is organized around a simple pipeline:

`UI / API route -> SearchService -> Provider -> Normalizer -> Repository -> SQLite`

The overall goal is to turn retailer scraping into a persistent product intelligence workflow instead of an ephemeral one-off scrape.

## Main components

### UI and API layer

- `pages/index.js` provides a manual engineering console.
- `pages/api/search.js` is the main service entrypoint.
- The API accepts `{ query, provider, pageNum }`, selects a provider singleton, and forwards the work to `SearchService`.

### Provider layer

Providers live under `src/providers/`.
They share a common response shape so the rest of the stack can remain provider-agnostic.
The repository currently includes:

- `PichauProvider`
- `KabumProvider`
- `MercadoLivreProvider`

Their differences are mainly in selectors, navigation flow, pagination, and anti-bot handling.

### Normalization layer

`src/providers/normalizer.js` converts raw provider products into a shared schema.
It is responsible for:

- cleaning noisy titles
- detecting brands and models
- extracting storage and memory capacity
- normalizing BRL prices
- inferring availability

The original provider values are preserved alongside normalized values.

### Search orchestration

`src/services/SearchService.js` wraps provider execution.
It:

- generates a search UUID
- calls the provider
- normalizes products
- persists search metadata and product rows
- returns raw products and normalized products together

Even failures are recorded as search rows so the database captures what happened.

### Repository and storage

`src/repository/Repository.js` defines the abstraction.
`src/repository/SQLiteRepository.js` is the current implementation.

The repository stores three logical record types:

- `searches`
- `raw_products`
- `normalized_products`

The schema is prepared for future evolution, including schema versioning, canonical mapping, and price history.

## Why the architecture is shaped this way

### Persistence is first-class

The repository does not only scrape results; it also stores them.
That makes it possible to audit searches, compare providers, and build future reporting layers without rerunning the scrape.

### Provider-specific scraping stays isolated

Retail sites differ enough that the repository keeps provider code separate.
That reduces coupling and lets each site use the selector and waiting strategy it needs.

### Normalization is shared

Normalization was split out so multiple providers can feed the same downstream data model.
That is important for cross-provider comparison and future deduplication.

### Repository abstraction keeps future storage options open

SQLite is the current backend, but the interface leaves room for PostgreSQL or another backend later.

## Important source evidence

- `src/services/SearchService.js` — orchestration and persistence flow
- `src/repository/Repository.js` — storage interface
- `src/repository/SQLiteRepository.js` — schema and insert/read logic
- `src/providers/normalizer.js` — shared normalization functions
- `docs/ARCHITECTURE.md` — long-form design notes and rationale

## Change guidance

When modifying architecture-related behavior:

- keep the provider response shape stable
- preserve raw provider fields when adding normalized fields
- update both the service layer and repository if the persisted shape changes
- verify the API response still includes `searchId`, `persistence`, and `normalizedProducts`
- run provider regression tests after changing selectors or wait logic

## Related pages

- [Provider behavior](providers.md)
- [Data model and tests](../data-and-tests.md)

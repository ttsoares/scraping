# Architecture

src/
  providers/
    ProductProvider.ts
    pichau/
      PichauProvider.ts
      Browser.ts
      strategies/
        NetworkStrategy.ts
        EmbeddedJsonStrategy.ts
        DomStrategy.ts
      Parser.ts
      Cache.ts
      Errors.ts
      Selectors.ts

Interfaces:

SearchOptions
Product
SearchResult
ProductProvider

Never expose Playwright outside provider implementation.

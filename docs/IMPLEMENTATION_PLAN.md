# Implementation Plan

Priority:

1. Discover JSON endpoints via Playwright request interception.
2. Parse embedded __NEXT_DATA__ or JSON-LD.
3. Implement DOM parser only if necessary.

Performance:

- Reuse browser.
- Reuse browser context.
- Abort images/fonts/media.
- Optional short-lived cache.

Errors:

NavigationError
BlockedError
TimeoutError
ExtractionError
ParseError

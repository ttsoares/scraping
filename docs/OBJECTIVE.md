# Objective

Implement a ProductProvider capable of searching Pichau without using an official API.

Public API must remain independent from Playwright.

Success:

- provider.search("ssd 1tb sata") returns normalized products.
- Provider architecture allows future retailers with minimal changes.

When a conclusion is based on incomplete evidence, distinguish between:

Observed:
    directly verified by experiment

Inferred:
    likely but unverified

Unknown:
    requires another experiment

# Checklist

- [x] Research completed
- [x] Network endpoints documented
- [x] Strategy selected
- [x] Provider implemented
- [x] Tests passing
- [x] Verifier passing (53 products, all fields present)
- [x] Documentation updated

## Fix Summary

Resolved two issues in `PichauProvider.js`:

1. **`$$eval` timing** - Replaced fixed `waitForTimeout(1500)` with `waitForFunction` that waits for actual product count > 0 (not just selector existence), eliminating the 0-product race condition during RSC navigation. Added retry logic if $$eval still returns 0.

2. **`price: null` for compound prices** - Updated `parsePrice()` to handle compound price text like "de R$ 15,28 por" by extracting all R$ values and returning the first one that converts cleanly.

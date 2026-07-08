# Loop 2 - Reach the Application

Read all documentation before coding.

## Goal

Obtain the real search page rather than the Cloudflare challenge.

Do not implement ProductProvider until this goal succeeds.

## Research experiments

Perform and document multiple experiments.

1. Current Playwright baseline.
2. Latest Playwright.
3. launchPersistentContext().
4. Headed mode.
5. System Google Chrome (if available).
6. Home page first, then search.
7. Wait 30-60 seconds for challenge completion.
8. Capture cookies and storage state.
9. Simulate light human interaction (mouse movement, scrolling).

## Browser fingerprint research

Experiment 1

Objective:

Remove the obvious HeadlessChrome fingerprint.

Allowed changes:

- playwright-extra
- stealth plugin

Do not modify anything else.

Success:

The browser reaches the real Pichau page.

Otherwise:

Produce evidence explaining why the experiment failed.
Hide obvious automation signals and browser fingerprints using community-maintained solutions rather than custom hacks.

## Deliverables

docs/research/pichau-site-analysis.md
docs/research/cloudflare-analysis.md

Save:

- HAR (if possible)
- HTML snapshots
- Cookies
- Storage state
- Request logs
- Response logs

## Success criteria

A saved HTML page contains actual products instead of the Cloudflare challenge.

If unsuccessful, produce a ranked comparison of all attempted approaches and explain why each failed.

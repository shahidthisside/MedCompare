# Phase 7: Value Features

## Goal
Features that make MedCompare clearly better than existing comparison sites.

## Tasks
- [ ] **Cart optimizer**: best single-pharmacy total, best split (exhaustive for ≤8 items × ≤14 sources; greedy above), handling missing items and pack-size rounding ("you need 30 tablets → 2 strips of 15").
- [ ] **Substitutes v2**: rank by per-unit price, show manufacturer, "Jan Aushadhi" and "NLEM" badges, savings per month for a given dose ("1 tablet twice a day").
- [ ] **Jan Aushadhi**: equivalent product + MRP; nearest Kendras by PIN (distance via PIN centroids); open in maps.
- [ ] **NPPA ceiling flag** on listings above ceiling, with notification reference and link.
- [ ] **Price history**: 90-day chart per source, "lowest in 30 days" indicator.
- [ ] **Accounts (Better Auth)**: magic link + Google; saved carts; account deletion; DPDP-compliant consent text.
- [ ] **Price alerts**: "notify me when below ₹X or drops 10%"; checked after each price write; Web Push + email; unsubscribe link; per-user limit.
- [ ] **Share**: shareable cart link (`/cart/s/<id>`, no PII).
- [ ] (Optional) **Prescription scan**: upload photo, OCR (Tesseract.js client-side first, for privacy), fuzzy-match lines to products, user confirms. Image not stored.
- [ ] **PWA**: installable, offline shell, recent searches available offline.

## Exit criteria
- Unit tests for optimizer (including brute-force cross-check on random carts) and alert triggering.
- e2e: create alert → simulate price drop → notification sent (test mailbox).
- Account deletion removes all user rows (test).

## Result
_(fill in)_

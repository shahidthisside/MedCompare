# Phase 3: Normalization & Matching

## Goal
Every listing is attached to the correct product and pack variant, so the comparison table compares identical medicines.

## Tasks
- [ ] `matchListing(raw) → {productId, packVariantId, confidence, reasons[]}` in `packages/core/matching`, pure and deterministic.
- [ ] Candidate generation: exact composition key + form, then trigram on brand name within that set, then manufacturer similarity.
- [ ] Scoring weights tuned on the Phase 0 labelled set; thresholds: ≥0.92 auto, 0.75–0.92 review, <0.75 creates a new product.
- [ ] Hard rules (never match): different strength, different release type (SR/ER/CR/MR vs IR), different form family, different salt count.
- [ ] Review queue: `/admin/matches` page with approve / reassign / reject; decisions stored and re-used (`match_override`).
- [ ] Substitute query: same composition key + form + release type, excluding banned FDCs.
- [ ] Back-fill job: re-match all listings when rules change (versioned `matcher_version` on listing).
- [ ] Metrics: precision/recall on the labelled set printed by `pnpm test:matching`.

## Exit criteria
- Precision ≥ 95% and recall ≥ 85% on the labelled set (expand it to ≥500 examples during this phase).
- ≥80% of crawled P1 listings auto-matched; review queue < 10%.
- Zero cross-strength matches in a manual audit of 100 random auto-matches.

## Result
_(fill in)_

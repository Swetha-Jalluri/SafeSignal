# Session log: apps/doctor-web

Newest first. Per session: what was done, state at the end, next steps.

## 2026-11-07 · Session 3 (architecture, docs, component branches)
**Done**
- Added `ARCHITECTURE.md`: system, in-app and envelope-sequence diagrams mapped to the repo layout.
- Trimmed `CLAUDE.md` to the essentials; added DW-14 (one branch per component).
- Split the work into stacked branches: `doctor/scaffold` → `doctor/sync-engine` → `doctor/doctor-view` → `doctor/caregiver-view`, each building on its own, and pushed them. `doctor/doctor-web-v1` is replaced by these.

- Opened stacked PRs #1–#4.
- Added `evals/doctor/access_checks.py` on `doctor/access-checks`; 11/11 pass on the stub (missed alert skipped: no scheduler). Results in `evals/doctor/results/`.

**State**
- Branches pushed, not merged. The four open requests in `DECISIONS.md` are still with the company owner.

**Next**
1. Review and merge PRs #1–#4 in order, then the access-checks PR. Rerun `evals/doctor/access_checks.py` after each service switch-over (H3, H5).
2. Switch to the real patient runtime when it sends envelopes; run the 26.15 Doctor and Access-control checks at H6.
3. Credits work (Gradium clips, Exa label facts) once keys are in `.env.local`.

## 2026-11-07 · Session 2 (moved into the repo, real service)
**Done**
- Ported the staging app into `apps/doctor-web` on branch `doctor/doctor-web-v1`, aligned with the brief: `@sentinel/contract`, Ajv on `schema/doctor_payload.json`, `sentinel_doctor_view` stores, fixture IDs, `VITE_DOCTOR_*`.
- Verified against the company stub service (in-memory) with `scripts/send_demo_envelope.py` as Walter's device: key registered, envelope decrypted, hash and schema checks passed, ack 200, severe alert shown, revoke → "No longer shared", caregiver view as Anna.
- `node scripts/parity.ts`: 8/8 repo hash vectors. Build, type-check and `check-secrets` pass; lint 0 errors.

**State**
- Not committed. Waiting on the open requests in `DECISIONS.md`.
- Stub is in-memory: restarting it drops the registered key; reload the app to re-register.

**Next**
1. Commit and push the branch when the user asks; run `scripts/check_ownership.sh` first.
2. Switch to the real patient runtime when it sends envelopes; run the 26.15 Doctor and Access-control checks at H6.
3. Credits work (Gradium clips, Exa label facts) once keys are in `.env.local`.

## 2026-11-07 · Session 1 (staging)
- Read the scoping doc; built the doctor + caregiver app in `~/sentinel-staging/web/doctor` against an in-browser mock. Python ↔ browser sealed-box and hash parity: 4/4.

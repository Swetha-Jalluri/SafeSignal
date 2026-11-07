# Decision log: apps/doctor-web

This app's own decisions, newest first. Repo-wide decisions are in `docs/DECISIONS.md` and win on conflict. Supersede rather than delete.

| # | Date | Decision | Why | By |
|---|---|---|---|---|
| DW-15 | 2026-11-07 | Doctor-side 26.15 checks live in `evals/doctor/` on their own branch `doctor/access-checks` (off `main`) | Evals are a separate component and don't depend on the app stack | Claude |
| DW-14 | 2026-11-07 | Push as stacked branches, one per component: `doctor/scaffold` → `doctor/sync-engine` → `doctor/doctor-view` → `doctor/caregiver-view` | Smaller reviews; never touch `main` directly | User |
| DW-13 | 2026-11-07 | Selection follows the most urgent patient until the doctor clicks one | A new severe alert should surface without a click | Claude |
| DW-12 | 2026-11-07 | Revoked patients move to a collapsed "No longer shared" list, read-only, with a banner (supersedes DW-03) | D-038: keep decrypted data and mark the patient | Repo |
| DW-11 | 2026-11-07 | Active links and rejections are held in memory; check-in days are derived from timeline entries (supersedes DW-07) | `doctor_view.sql` defines exactly five stores, with no general store | Repo |
| DW-10 | 2026-11-07 | Use `@sentinel/contract` for hashing and types, Ajv 2020 on `schema/doctor_payload.json`, IndexedDB `sentinel_doctor_view`, `VITE_DOCTOR_*` env vars | Doctor brief + D-026 / D-031 | Repo |
| DW-09 | 2026-11-07 | Sort patients: unseen severe alert → worsening trend → unseen alerts → name | Most urgent first | Claude |
| DW-08 | 2026-11-07 | `last_checkin` ignores `status: missed` envelopes | A missed day is not a check-in | Claude |
| DW-07 | 2026-11-07 | ~~Per-day check-in status in a `meta` store~~ | Superseded by DW-11 | Claude |
| DW-06 | 2026-11-07 | Rejected envelopes are not acked; the cursor still advances | Avoids refetch loops | Claude |
| DW-05 | 2026-11-07 | Re-register the public key on every start | Patients get 404 until it exists (D-025); keeps the service on this browser's key | Claude |
| DW-04 | 2026-11-07 | Keep an in-browser mock that seals synthetic payloads to the browser's key | Offline UI work and a demo fallback; the repo stub needs `scripts/send_demo_envelope.py` for data | Claude |
| DW-03 | 2026-11-07 | ~~Revoked → hide~~ | Superseded by DW-12 | User |
| DW-02 | 2026-11-07 | Caregiver view lives in this app | Team decision (closes D-039 once the company owner records it) | User |
| DW-01 | 2026-11-07 | Doctor app is its own Vite app on port 5174 | D-026 | User |

## Sponsor credits (codes and keys never in the repo)
Rule: no cloud service touches patient data. Credits are spent at build time on public or synthetic data, or on the pitch.

| Credit | Use here | Never |
|---|---|---|
| Gradium 100K | Pre-rendered caregiver alert audio; synthetic voices for tests and video; "Best Use of Gradium" prize | Live check-ins or runtime calls |
| Exa $50 / Tavily 8K | Build-time cited label facts per term code, shipped as static JSON; pitch research | Queries containing anything from a decrypted payload |
| Sanity 1 yr | Company owner's call (non-patient content) | Records or alerts |
| Bravado $200, Claude Pro | Pending | — |

## Open: requests to the company owner
1. **Check-in rows:** `doctor_view.sql` stores only symptom rows, so check-ins with no symptoms and missed check-ins can't appear on the timeline. Proposed: a `dr_checkin(envelope_id PK, patient_ref, checkin_date, status, trend)` store.
2. **D-039:** record "caregiver view in doctor-web" and add `GET /v1/caregivers/{id}/alerts` to the doctor brief's allowed calls.
3. **CODEOWNERS:** replace `@DOCTOR_OWNER` with the doctor owner's GitHub handle (D-046).
4. **Audio:** root `.gitignore` drops `*.mp3`/`*.wav`. Gradium clips are synthetic, non-patient audio: allow a path (for example `apps/doctor-web/public/audio/`) or regenerate them at build time.
5. **Check order (minor):** relay endpoints validate the body before the role, so a company user with a malformed body gets 422, not 403. Nothing leaks; checking role first would make 26.15 "company role → 403" hold for any body.

# Changelog: apps/doctor-web

Changes in this app, newest first. Owned by this app's owner (root `CLAUDE.md`).

## 2026-11-07
- Added: `ARCHITECTURE.md` (system, app and sequence diagrams; component branches).
- Changed: `CLAUDE.md` trimmed; points to architecture, decisions and session log.
- Added: doctor view (DR-01..04): consented patient list sorted by urgency, 21-day symptom grid, severity chart, template pre-visit summary, alerts panel with mark-seen.
- Added: caregiver view at `#/caregiver` (alert type and time only).
- Added: sync engine: X25519 key in `dr_key`, public key registered on every start, `since` paging with cursors in `dr_sync_state`, sealed-box decrypt, `payloadSha256` check, Ajv validation on `schema/doctor_payload.json`, upsert, ack; rejections are not acked.
- Added: revoked patients kept read-only under "No longer shared" (D-038).
- Added: in-browser mock service and dev panel (used when `VITE_DOCTOR_SERVICE_URL` is unset).
- Added: `scripts/parity.ts` (repo hash vectors, 8/8) and `scripts/check-secrets.sh` (runs after every build).
- Verified against the stub service with `scripts/send_demo_envelope.py`.

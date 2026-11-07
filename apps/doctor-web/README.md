# Doctor view

- **Owner:** Doctor side (see `CODEOWNERS`)
- **Package name:** `@sentinel/doctor-web`
- **Port:** 5174
- **Runtime data:** IndexedDB `sentinel_doctor_view`, stores per `schema/doctor_view.sql`
- **Contract:** read `schema/`; never edit it. Hashing and types come from `packages/` (see the root README).
- **Agent instructions:** `CLAUDE.md` in this folder; it imports the brief `docs/briefs/doctor-web.md` (company-maintained) and holds your own notes. `AGENTS.md` points to both.
- **Service status:** `docs/INTEGRATION_STATUS.md` · **Demo IDs:** `schema/demo_fixtures.json`
- **Original brief:** Scoping Doc 26.14, Doctor layer brief. Paths in that brief map to this repo as: `web/doctor/` → `apps/doctor-web/`; generated types → `import type { paths } from "@sentinel/contract/api"`; hashing → `import { payloadSha256 } from "@sentinel/contract"`.

Structure inside this folder is up to its owner.

## Run
```bash
npm install
cp .env.example .env.local     # set VITE_DOCTOR_SERVICE_URL=http://127.0.0.1:8000, or leave empty for the in-browser mock
npm run dev                    # doctor: http://localhost:5174 · caregiver: http://localhost:5174/#/caregiver
```
With the service running (origin `http://localhost:5174` allowed), open the app once to register the key, then send test data from the repo root:
`uv run --project packages/contract-py python scripts/send_demo_envelope.py --alert`.

Checks: `node scripts/parity.ts` (hash vectors) · `npm run build` (includes `check-secrets`).
Architecture: `ARCHITECTURE.md` · decisions and open requests: `DECISIONS.md` · progress: `SESSION_LOG.md`.

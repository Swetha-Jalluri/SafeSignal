# Architecture: apps/doctor-web

How the doctor and caregiver views fit into the SafeSignal repo. Folder names, ports and calls match `README.md`, `CODEOWNERS`, `schema/` and `docs/briefs/doctor-web.md`. If this file disagrees with them, they win.

## 1. Whole system (repo layout)

```mermaid
flowchart LR
  subgraph PATIENT["Patient side (patient owner) · Walter's device"]
    PW["apps/patient-web<br/>:5173"]
    PR["apps/patient-runtime<br/>sentinel_patient :8001<br/>speech-to-text → model → filter → egress gate"]
    PDB[("var/patient/patient.db")]
    PW -->|localhost only| PR
    PR --- PDB
  end

  subgraph COMPANY["Company side (company owner)"]
    SVC["apps/service<br/>sentinel_service :8000<br/>API · relay · scheduler"]
    CDB[("var/service/company.db")]
    RDB[("var/service/relay.db<br/>ciphertext only")]
    CW["apps/company-web<br/>:5175"]
    SVC --- CDB
    SVC --- RDB
    CW -->|/v1/company/*| SVC
  end

  subgraph DOCTOR["Doctor side (doctor owner) · apps/doctor-web :5174"]
    DV["Doctor view<br/>Dr. Shah dr_3a7f10b2"]
    CG["Caregiver view #/caregiver<br/>Anna cg_7e21c9a4"]
    IDB[("IndexedDB sentinel_doctor_view<br/>dr_patient · dr_timeline_entry · dr_alert<br/>dr_key · dr_sync_state")]
    DV --- IDB
  end

  subgraph SHARED["Contract (company owner, read-only for others)"]
    SCH["schema/<br/>SQL · JSON Schemas · enums · terms · openapi.json"]
    PKG["packages/contract-py · packages/contract-ts<br/>hashing · validation · API types"]
  end

  PR -->|"POST /v1/records (coded fields, company)"| SVC
  PR -->|"POST /v1/doctor-envelopes (sealed to doctor key)"| SVC
  PR -->|"POST /v1/alerts · PUT /v1/consent"| SVC
  PR -->|"GET /v1/doctors/{id}/public-key"| SVC
  DV -->|"PUT public-key · GET patients / envelopes / alerts · POST ack"| SVC
  CG -->|"GET /v1/caregivers/{id}/alerts"| SVC
  PKG -.-> PR
  PKG -.-> SVC
  PKG -.-> DV
  SCH -.-> PKG
```

Privacy line: the service only ever holds ciphertext for the doctor. The private key lives in `dr_key` in the doctor's browser, so only that browser can read check-ins.

## 2. Inside apps/doctor-web

```mermaid
flowchart TB
  subgraph UI["src/components/"]
    APP["App.tsx<br/>routes #/ and #/caregiver"]
    DVIEW["DoctorView<br/>patient list, sorted by urgency"]
    TL["Timeline<br/>21-day grid + severity chart"]
    SUM["PreVisitSummary<br/>templates only, no AI"]
    AL["AlertsPanel"]
    CGV["CaregiverView<br/>alert type + time only"]
  end

  subgraph LIB["src/lib/"]
    HOOK["useDoctorData<br/>polls, builds rows"]
    SYNC["sync.ts<br/>fetch → decrypt → hash → validate → store → ack"]
    API["api.ts<br/>X-Role / X-Actor-Id headers"]
    CRY["crypto.ts<br/>libsodium X25519 sealed box"]
    VAL["validate.ts<br/>Ajv 2020 on schema/doctor_payload.json"]
    DB["db.ts<br/>IndexedDB, 5 stores"]
    CFG["config.ts · types.ts · terms.ts"]
  end

  subgraph DEV["src/dev/ (only when VITE_DOCTOR_SERVICE_URL is unset)"]
    MOCK["mockServer.ts<br/>seals synthetic payloads to this browser's key"]
    PANEL["DevPanel"]
  end

  APP --> DVIEW --> TL & SUM & AL
  APP --> CGV --> API
  DVIEW --> HOOK --> SYNC
  SYNC --> API & CRY & VAL & DB
  SYNC -.->|payloadSha256| CT["@sentinel/contract"]
  API -->|real| SVC["apps/service :8000"]
  API -->|mock| MOCK
  PANEL --> MOCK
```

## 3. One envelope, end to end

```mermaid
sequenceDiagram
  participant B as Doctor browser (doctor-web)
  participant S as apps/service
  participant P as patient-runtime (Walter)
  B->>B: first launch: generate X25519 key pair, keep private key in dr_key
  B->>S: PUT /v1/doctors/dr_3a7f10b2/public-key
  P->>S: GET public-key (404 until registered, D-025)
  P->>S: POST /v1/doctor-envelopes (sealed box + payload_sha256)
  P->>S: POST /v1/alerts (severe, optional)
  loop every poll / "Sync now"
    B->>S: GET patients (active care links only)
    B->>S: GET envelopes?since=cursor
    B->>B: open sealed box → payloadSha256 matches → schema valid?
    alt valid
      B->>B: upsert dr_patient / dr_timeline_entry
      B->>S: POST .../envelopes/{id}/ack
    else invalid
      B->>B: reject, no ack, advance cursor (DW-06)
    end
    B->>S: GET alerts?since=cursor → dr_alert
  end
  Note over B,S: Nothing decrypted ever leaves the browser.
```

## 4. Component branches

Work is pushed as a stack of branches, one per component. Each branch builds on the one before it, so merge them in this order:

| # | Branch | Contents |
|---|---|---|
| 1 | `doctor/scaffold` | Vite/React/TS/Tailwind setup, configs, `check-secrets.sh`, app docs (this file, logs, CLAUDE.md) |
| 2 | `doctor/sync-engine` | `src/lib/*`, `src/dev/mockServer.ts`, `scripts/parity.ts` |
| 3 | `doctor/doctor-view` | `DoctorView`, `Timeline`, `PreVisitSummary`, `AlertsPanel`, `DevPanel`, doctor route |
| 4 | `doctor/caregiver-view` | `CaregiverView`, `#/caregiver` route |

Run `scripts/check_ownership.sh` before every push. Never push to `main` directly.

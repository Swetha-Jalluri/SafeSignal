"""Doctor-side checks from Scoping Doc 26.15 (Access control, Privacy, End to end), run against a live service.

Plays several roles over HTTP only (company user, a stranger doctor, Walter's device, Dr. Shah, Anna). It never reads
a database file. It prints and records only check names, status codes, IDs and timings, never payload contents.

Run from the repo root with the service running:
  uv run --project packages/contract-py python evals/doctor/access_checks.py [--base-url URL] [--write]

Key handling: if Dr. Shah already has a public key (the doctor web app is open), the checks seal to that key and
skip decryption, so the open app keeps working. Otherwise they register a throwaway key and also check
decrypt + hash. In that case, reload the doctor web app afterwards so it registers its own key again.
"""

from __future__ import annotations

import argparse
import base64
import json
import secrets
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx
from nacl.public import PrivateKey, SealedBox
from sentinel_contract import SCHEMA_DIR, payload_sha256
from sentinel_contract.client import SendRejected, SentinelClient, build_envelope

ROOT = Path(__file__).resolve().parents[2]
FIX = json.loads((SCHEMA_DIR / "demo_fixtures.json").read_text())
DR = FIX["doctors"][0]["doctor_id"]
CG = FIX["caregivers"][0]["caregiver_id"]
WALTER = next(p for p in FIX["device_profiles"] if p["display_name"] == "Walter")
PT = WALTER["patient_ref"]
STRANGER_DR = "dr_00000000"  # not in the fixtures: no care links
COMPANY = next(u for u in FIX["company_users"] if u["role"] == "company_safety")["user_id"]

results: list[dict] = []


def check(section: str, name: str, ok: bool, detail: str) -> None:
    results.append({"section": section, "check": name, "pass": bool(ok), "detail": detail})
    print(f"{'PASS' if ok else 'FAIL'}  [{section}] {name}: {detail}")


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def as_role(role: str, actor: str) -> dict:
    return {"X-Role": role, "X-Actor-Id": actor}


def plaintext(trend: str = "worse") -> dict:
    p = json.loads((SCHEMA_DIR / "examples" / "doctor_payload.valid.json").read_text())
    p.update(checkin_date=datetime.now(timezone.utc).strftime("%Y-%m-%d"), trend=trend)
    return p


def consent(share_doctor: bool) -> dict:
    c = json.loads((SCHEMA_DIR / "examples" / "consent_update.valid.json").read_text())
    c["share_doctor"] = share_doctor
    return c


def send_env(walter: SentinelClient, key: str, doctor_id: str = DR) -> tuple[int, dict]:
    env = build_envelope(f"env_{secrets.token_hex(4)}", doctor_id, plaintext(), key)
    try:
        return walter.send_envelope(env).status_code, env
    except SendRejected as e:
        return e.status, env


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://127.0.0.1:8000")
    ap.add_argument("--write", action="store_true", help="save results to evals/doctor/results/")
    args = ap.parse_args()

    http = httpx.Client(base_url=args.base_url, timeout=10)
    walter = SentinelClient(args.base_url, PT)
    doc = as_role("doctor", DR)

    # ---- key: reuse the doctor app's key if registered, else a throwaway one ----
    r = http.get(f"/v1/doctors/{DR}/public-key", headers=as_role("patient_device", PT))
    own_key: PrivateKey | None = None
    if r.status_code == 200:
        key_b64 = r.json()["public_key"]
        print("Using the doctor app's registered key (decrypt check skipped).")
    else:
        own_key = PrivateKey.generate()
        key_b64 = base64.b64encode(bytes(own_key.public_key)).decode()
        http.put(f"/v1/doctors/{DR}/public-key", headers=doc, json={"public_key": key_b64}).raise_for_status()
        print("No key registered: using a throwaway key. Reload the doctor web app afterwards.")

    # ---- Contract: doctor-side hash vectors ----
    if (ROOT / "apps/doctor-web/scripts/parity.ts").exists():
        p = subprocess.run(["node", "scripts/parity.ts"], cwd=ROOT / "apps/doctor-web", capture_output=True, text=True)
        tail = (p.stdout.strip().splitlines() or ["no output"])[-1]
        check("Contract", "Doctor layer passes hash_vectors.json", p.returncode == 0 and "passed" in tail, tail)
    else:
        print("SKIP  [Contract] Doctor hash vectors: apps/doctor-web/scripts/parity.ts not on this branch yet.")

    # ---- Access control ----
    relay = [
        ("GET", f"/v1/doctors/{DR}/patients"), ("GET", f"/v1/doctors/{DR}/envelopes"),
        ("GET", f"/v1/doctors/{DR}/alerts"), ("POST", f"/v1/doctors/{DR}/envelopes/env_00000000/ack"),
        ("PUT", f"/v1/doctors/{DR}/public-key"), ("GET", f"/v1/caregivers/{CG}/alerts"),
    ]
    # Well-formed bodies, so a 403 comes from the role check and not from body validation.
    body = {"public_key": key_b64, "fetched_at": now()}
    codes = {f"{m} {u}": http.request(m, u, headers=as_role("company_safety", COMPANY), json=body).status_code
             for m, u in relay}
    bad = [f"{k} -> {v}" for k, v in codes.items() if v != 403]
    check("Access control", "Company role cannot reach any relay endpoint", not bad,
          f"{len(relay)} endpoints all 403" if not bad else "; ".join(bad))

    c1 = http.get(f"/v1/doctors/{STRANGER_DR}/envelopes", headers=doc).status_code
    c2 = http.get(f"/v1/doctors/{DR}/envelopes", headers=as_role("doctor", STRANGER_DR)).status_code
    check("Access control", "A doctor cannot read another doctor's envelopes", c1 == 403 and c2 == 403,
          f"other path {c1}, other actor {c2}")

    s1 = http.get(f"/v1/doctors/{STRANGER_DR}/patients", headers=as_role("doctor", STRANGER_DR))
    listed = [x["patient_ref"] for x in s1.json()] if s1.status_code == 200 else []
    check("Access control", "A doctor without a care link sees no patients", s1.status_code in (403, 404) or not listed,
          f"{s1.status_code}, {len(listed)} patient(s)")

    code, _ = send_env(walter, key_b64, STRANGER_DR)
    check("Access control", "A patient cannot send an envelope to a doctor without a care link", code == 403,
          f"-> {code}")

    missing = http.get(f"/v1/doctors/{DR}/patients").status_code
    check("Access control", "Requests without X-Role / X-Actor-Id are refused", missing == 401, f"-> {missing}")

    # ---- Revoke stops the next envelope; restore afterwards ----
    try:
        walter.send_consent(consent(False))
        code, _ = send_env(walter, key_b64)
        pts = [x["patient_ref"] for x in http.get(f"/v1/doctors/{DR}/patients", headers=doc).json()]
        check("Access control", "Revoking consent stops the next envelope", code == 403 and PT not in pts,
              f"envelope -> {code}; {PT} listed: {PT in pts}")
    finally:
        walter.send_consent(consent(True))

    # ---- End to end + privacy: envelope arrives, ciphertext only ----
    since = now()
    time.sleep(1.1)  # `since` is strictly-after with 1-second timestamps
    t0 = time.monotonic()
    code, env = send_env(walter, key_b64)
    got = None
    while time.monotonic() - t0 < 60 and got is None:
        rows = http.get(f"/v1/doctors/{DR}/envelopes", headers=doc, params={"since": since}).json()
        got = next((x for x in rows if x["envelope_id"] == env["envelope_id"]), None)
        if got is None:
            time.sleep(1)
    dt = time.monotonic() - t0
    check("End to end", "Walter's envelope reaches the doctor within 1 minute", code == 201 and got is not None,
          f"send {code}, visible after {dt:.1f}s")

    if got:
        raw = base64.b64decode(got["ciphertext"])
        try:
            json.loads(raw)
            is_json = True
        except ValueError:
            is_json = False
        leaked = [k for k in ("symptoms", "term_code", PT, "checkin_date") if k.encode() in raw]
        check("Privacy", "Relay returns only ciphertext for the doctor", not is_json and not leaked,
              f"{len(raw)} bytes, parses as JSON: {is_json}, plaintext markers: {len(leaked)}")
        if own_key:
            opened = json.loads(SealedBox(own_key).decrypt(raw))
            ok = payload_sha256(opened) == got["payload_sha256"]
            check("End to end", "Doctor key decrypts it and the hash matches", ok, "sha256 match" if ok else "mismatch")
        ack = http.post(f"/v1/doctors/{DR}/envelopes/{got['envelope_id']}/ack", headers=doc).status_code
        check("End to end", "Doctor can acknowledge the envelope", ack == 200, f"-> {ack}")

    # ---- Severe alert reaches doctor and caregiver ----
    since = now()
    time.sleep(1.1)
    alert = {"schema_version": "1.0", "alert_id": f"alt_{secrets.token_hex(4)}", "patient_ref": PT,
             "alert_type": "severe", "created_at": now()}
    t0 = time.monotonic()
    walter.send_alert(alert)
    seen_dr = seen_cg = False
    while time.monotonic() - t0 < 60 and not (seen_dr and seen_cg):
        d = http.get(f"/v1/doctors/{DR}/alerts", headers=doc, params={"since": since}).json()
        c = http.get(f"/v1/caregivers/{CG}/alerts", headers=as_role("caregiver", CG)).json()
        seen_dr = any(x["alert_id"] == alert["alert_id"] for x in d)
        seen_cg = any(x.get("alert_id") == alert["alert_id"] for x in c)
        if not (seen_dr and seen_cg):
            time.sleep(1)
    check("End to end", "Severe alert reaches doctor and caregiver", seen_dr and seen_cg,
          f"doctor {seen_dr}, caregiver {seen_cg}, after {time.monotonic() - t0:.1f}s")
    fields = sorted({k for x in c for k in x}) if c else []
    check("Privacy", "Caregiver alert has no symptom details (AL-03)",
          not any(k in fields for k in ("symptoms", "term_code", "severity")), f"fields: {', '.join(fields)}")

    # ---- Not built yet: report, don't fail ----
    print("SKIP  [End to end] Missed check-in alert within 1 minute: service scheduler not built (INTEGRATION_STATUS).")

    passed = sum(r["pass"] for r in results)
    print(f"\n{passed}/{len(results)} passed")
    if args.write:
        out = ROOT / "evals/doctor/results" / f"access_checks_{datetime.now().strftime('%Y-%m-%d_%H%M')}.json"
        out.write_text(json.dumps({"run_at": now(), "base_url": args.base_url, "passed": passed,
                                   "total": len(results), "results": results}, indent=2) + "\n")
        print(f"wrote {out.relative_to(ROOT)}")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())

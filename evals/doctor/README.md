# Doctor evals

Doctor-side checks from Scoping Doc 26.15, run against a live service over HTTP. No database files are read, and only check names, status codes, IDs and timings are printed or saved.

```bash
# from the repo root, service running (docs/INTEGRATION_STATUS.md)
uv run --project packages/contract-py python evals/doctor/access_checks.py          # print results
uv run --project packages/contract-py python evals/doctor/access_checks.py --write  # also save to results/
```

| Section | Checks |
|---|---|
| Contract | Doctor hash vectors (`apps/doctor-web/scripts/parity.ts`) |
| Access control | Company role gets 403 on every relay endpoint · a doctor can't read another doctor's envelopes · no care link means no patients and no envelopes · missing headers get 401 · revoking consent stops the next envelope |
| Privacy | The relay returns ciphertext only · caregiver alerts carry no symptom details (AL-03) |
| End to end | Envelope reaches the doctor within 1 minute · ack works · severe alert reaches doctor and caregiver · decrypt and hash match (only with a throwaway key) |

- The script changes consent during the revoke check and always restores it.
- If the doctor web app has registered its key, the script seals to that key and skips the decrypt check, so the app keeps working. If no key is registered, it registers a throwaway key; reload the doctor app afterwards.
- Missed check-in alerts are skipped until the service scheduler exists.

Results are committed in `results/`, failures included.

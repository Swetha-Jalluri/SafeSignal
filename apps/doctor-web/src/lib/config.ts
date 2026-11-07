// Set in apps/doctor-web/.env.local (git-ignored). With no service URL, the app runs against the in-browser mock.
// Demo IDs come from schema/demo_fixtures.json.
const env = import.meta.env

export const config = {
  baseUrl: (env.VITE_DOCTOR_SERVICE_URL as string | undefined)?.replace(/\/$/, '') ?? '',
  doctorId: (env.VITE_DOCTOR_ID as string | undefined) ?? 'dr_3a7f10b2',
  caregiverId: (env.VITE_DOCTOR_CAREGIVER_ID as string | undefined) ?? 'cg_7e21c9a4',
  caregiverPatientLabel: (env.VITE_DOCTOR_CAREGIVER_PATIENT_LABEL as string | undefined) ?? 'Walter',
  pollMs: Number(env.VITE_DOCTOR_POLL_MS ?? 10000),
  get mock() {
    return env.VITE_DOCTOR_MOCK === '1' || !this.baseUrl
  },
}

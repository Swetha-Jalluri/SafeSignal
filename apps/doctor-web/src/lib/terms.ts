// Display labels for term codes (Appendix 25.3). Replace with GET /v1/terms data if the doctor brief allows it later.
export const TERM_LABELS: Record<string, string> = {
  SE_RASH: 'Rash',
  SE_DRY_SKIN: 'Dry skin',
  SE_PARONYCHIA: 'Nail changes / infection',
  SE_DIARRHEA: 'Diarrhea',
  SE_STOMATITIS: 'Mouth sores',
  SE_FATIGUE: 'Fatigue',
  SE_DECREASED_APPETITE: 'Decreased appetite',
  SE_INFUSION_REACTION: 'Infusion-related reaction',
  SE_DYSPNEA: 'Shortness of breath',
  SE_COUGH: 'Cough',
  SE_EDEMA: 'Swelling',
  SE_OTHER_REVIEW: 'Other (needs review)',
}

export const termLabel = (code: string) =>
  TERM_LABELS[code] ?? code.replace(/^SE_/, '').replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())

export const SEVERITY_RANK = { mild: 1, moderate: 2, severe: 3 } as const

export const ONSET_LABELS: Record<string, string> = {
  today: 'today',
  '1_3_days': '1–3 days',
  '4_7_days': '4–7 days',
  over_7_days: 'over 7 days',
  unknown: 'unknown',
}

/**
 * Every time commitment customers can read in our policies and help pages,
 * and where it comes from. tests/legal/rendered-policies.test.ts fails if a
 * page adds, changes or drops one, so no deadline reaches customers without
 * being recorded here (and, for owner decisions, approved — see
 * docs/OWNER-DECISIONS.md and docs/POLICY-COMPARISON.md).
 */
export const APPROVED_TIME_COMMITMENTS: Record<string, Record<string, string>> = {
  privacy: {
    "10 business days": "CAN-SPAM opt-out deadline (15 U.S.C. 7704(a)(4); FTC compliance guide) — legal maximum, not a new promise",
    "12 months": "Partner retention: declined applications (RETENTION.declinedMonths, owner-approved 2026-10-26)",
    "24 months": "Partner retention: open applications / reseller interest / deletion-request records (RETENTION, owner-approved 2026-10-26)",
    "2 days": "Rate-limit codes deleted after 48 hours (RETENTION.rateLimitHours)",
    "30 days": "Privacy-request response target (owner decision pending; LEGAL-OPEN-QUESTIONS Q-PRIV-3)",
  },
  terms: {},
  shipping: {
    "2 business days": "Processing time for our own stock (owner decision S1, 2026-10-24)",
    "7 days": "Damage report window — a preference, not a cutoff (owner decision S4; wording clarified 2026-10-27)",
    "14 days": "'Delivered but missing' report window (owner decision S5)",
    "10 days": "Tracking not moving — contact us (approved text, 2026-10-24)",
    "30 days": "FTC Mail Order Rule delay thresholds (16 CFR 435.2(b)) — legal requirement",
    "7 business days": "Latest refund for canceled items: FTC 'prompt refund' (16 CFR 435.1) — legal maximum",
  },
  returns: {
    "7 days": "Damage report window — a preference, not a cutoff (owner decision S4/R6)",
    "30 days": "Change-of-mind return window (owner decision R1)",
    "5 business days": "Refund timing after we receive a return / approve a claim (owner decision R7)",
    "2 business days": "Usual review time for damage claims — 'usually', not a guarantee (proposed 2026-10-27, owner approval needed)",
    "7 business days": "Latest refund for canceled/unshipped orders: FTC 'prompt refund' (16 CFR 435.1) — legal maximum",
  },
  orderHelp: {
    "2 business days": "Processing time for our own stock (owner decision S1)",
    "7 days": "Damage report window — a preference (owner decision S4)",
  },
  faq: {
    "2 business days": "Processing time for our own stock (owner decision S1)",
    "7 days": "Damage report window — a preference (owner decision S4)",
    "30 days": "Change-of-mind return window (owner decision R1)",
  },
  productCare: {
    "20 minutes": "CPSC burn first-aid advice (Aug 5, 2026 squishy alert) — safety guidance, not a business commitment",
  },
  partners: {
    "12 months": "Partner retention: declined (RETENTION.declinedMonths)",
    "24 months": "Partner retention: others (RETENTION.openMonths)",
    "2 days": "Rate-limit codes (RETENTION.rateLimitHours)",
    "30 days": "Deletion-request deadline (RETENTION.deletionRequestDays, owner-approved 2026-10-26)",
  },
};

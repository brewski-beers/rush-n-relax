/**
 * Shipping eligibility — hardcoded, version-controlled, never stored in Firestore.
 * Only updated via PR with explicit compliance review.
 *
 * Hemp-derived cannabinoid (THCa, Delta-8, Delta-9 ≤0.3% dry weight) shipping
 * restrictions as of 2026. Laws change — review quarterly or after any state
 * legislative session.
 *
 * Sources:
 *   - USDA 2018 Farm Bill (federal baseline)
 *   - State-by-state hemp/THCa statutory analysis
 *
 * When a state's status is unclear or actively litigated, default to BLOCKED.
 * Better to lose a sale than ship into a legally hostile jurisdiction.
 */

export type StateCode =
  | 'AL'
  | 'AK'
  | 'AZ'
  | 'AR'
  | 'CA'
  | 'CO'
  | 'CT'
  | 'DE'
  | 'FL'
  | 'GA'
  | 'HI'
  | 'ID'
  | 'IL'
  | 'IN'
  | 'IA'
  | 'KS'
  | 'KY'
  | 'LA'
  | 'ME'
  | 'MD'
  | 'MA'
  | 'MI'
  | 'MN'
  | 'MS'
  | 'MO'
  | 'MT'
  | 'NE'
  | 'NV'
  | 'NH'
  | 'NJ'
  | 'NM'
  | 'NY'
  | 'NC'
  | 'ND'
  | 'OH'
  | 'OK'
  | 'OR'
  | 'PA'
  | 'RI'
  | 'SC'
  | 'SD'
  | 'TN'
  | 'TX'
  | 'UT'
  | 'VT'
  | 'VA'
  | 'WA'
  | 'WV'
  | 'WI'
  | 'WY'
  | 'DC';

export interface ShippingState {
  code: StateCode;
  name: string;
  /** Whether we ship hemp-derived cannabinoid products to this state */
  allowed: boolean;
  /** Human-readable reason shown to customer if blocked */
  blockedReason?: string;
}

/**
 * Full US state shipping eligibility list.
 *
 * BLOCKED states have explicit hemp/THCa prohibition statutes or enforcement
 * actions that create unacceptable legal exposure.
 *
 * ALLOWED states permit hemp-derived products under the 2018 Farm Bill with
 * no additional state-level prohibition at time of last review.
 *
 * ⚠️  LEGAL REVIEW REQUIRED before changing any entry.
 */
export const SHIPPING_STATES: ShippingState[] = [
  // ── Blocked ────────────────────────────────────────────────────────────
  {
    code: 'AK',
    name: 'Alaska',
    allowed: false,
    blockedReason: 'State law prohibits hemp-derived THC products.',
  },
  {
    code: 'AR',
    name: 'Arkansas',
    allowed: false,
    blockedReason: 'State law restricts hemp-derived Delta-9 and THCa.',
  },
  {
    code: 'CO',
    name: 'Colorado',
    allowed: false,
    blockedReason:
      'Colorado prohibits out-of-state hemp product shipments under state MED rules.',
  },
  {
    code: 'HI',
    name: 'Hawaii',
    allowed: false,
    blockedReason: 'State law restricts hemp-derived cannabinoid products.',
  },
  {
    code: 'ID',
    name: 'Idaho',
    allowed: false,
    blockedReason:
      'Idaho prohibits all THC including hemp-derived. Zero tolerance.',
  },
  {
    code: 'IA',
    name: 'Iowa',
    allowed: false,
    blockedReason: 'State law restricts hemp-derived THC products.',
  },
  {
    code: 'MA',
    name: 'Massachusetts',
    allowed: false,
    blockedReason: 'State law restricts hemp-derived cannabinoid products.',
  },
  {
    code: 'MN',
    name: 'Minnesota',
    allowed: false,
    blockedReason:
      'State hemp law has specific potency and serving restrictions that conflict with our products.',
  },
  {
    code: 'MS',
    name: 'Mississippi',
    allowed: false,
    blockedReason: 'State law restricts hemp-derived THC products.',
  },
  {
    code: 'MT',
    name: 'Montana',
    allowed: false,
    blockedReason: 'State law restricts hemp-derived cannabinoid products.',
  },
  {
    code: 'NY',
    name: 'New York',
    allowed: false,
    blockedReason:
      'NYSOCB regulations restrict out-of-state hemp-derived THC shipments.',
  },
  {
    code: 'ND',
    name: 'North Dakota',
    allowed: false,
    blockedReason: 'State law restricts hemp-derived THC products.',
  },
  {
    code: 'OR',
    name: 'Oregon',
    allowed: false,
    blockedReason: 'State law restricts hemp-derived cannabinoid products.',
  },
  {
    code: 'RI',
    name: 'Rhode Island',
    allowed: false,
    blockedReason: 'State law restricts hemp-derived THC products.',
  },
  {
    code: 'SD',
    name: 'South Dakota',
    allowed: false,
    blockedReason: 'State law prohibits hemp-derived THC products.',
  },
  {
    code: 'UT',
    name: 'Utah',
    allowed: false,
    blockedReason: 'State law restricts hemp-derived cannabinoid products.',
  },
  {
    code: 'VT',
    name: 'Vermont',
    allowed: false,
    blockedReason: 'State law restricts hemp-derived THC products.',
  },
  {
    code: 'WA',
    name: 'Washington',
    allowed: false,
    blockedReason:
      'State law restricts out-of-state hemp-derived THC shipments.',
  },

  // ── Allowed ────────────────────────────────────────────────────────────
  { code: 'AL', name: 'Alabama', allowed: true },
  { code: 'AZ', name: 'Arizona', allowed: true },
  { code: 'CA', name: 'California', allowed: true },
  { code: 'CT', name: 'Connecticut', allowed: true },
  { code: 'DE', name: 'Delaware', allowed: true },
  { code: 'FL', name: 'Florida', allowed: true },
  { code: 'GA', name: 'Georgia', allowed: true },
  { code: 'IL', name: 'Illinois', allowed: true },
  { code: 'IN', name: 'Indiana', allowed: true },
  { code: 'KS', name: 'Kansas', allowed: true },
  { code: 'KY', name: 'Kentucky', allowed: true },
  { code: 'LA', name: 'Louisiana', allowed: true },
  { code: 'ME', name: 'Maine', allowed: true },
  { code: 'MD', name: 'Maryland', allowed: true },
  { code: 'MI', name: 'Michigan', allowed: true },
  { code: 'MO', name: 'Missouri', allowed: true },
  { code: 'NE', name: 'Nebraska', allowed: true },
  { code: 'NV', name: 'Nevada', allowed: true },
  { code: 'NH', name: 'New Hampshire', allowed: true },
  { code: 'NJ', name: 'New Jersey', allowed: true },
  { code: 'NM', name: 'New Mexico', allowed: true },
  { code: 'NC', name: 'North Carolina', allowed: true },
  { code: 'OH', name: 'Ohio', allowed: true },
  { code: 'OK', name: 'Oklahoma', allowed: true },
  { code: 'PA', name: 'Pennsylvania', allowed: true },
  { code: 'SC', name: 'South Carolina', allowed: true },
  { code: 'TN', name: 'Tennessee', allowed: true },
  { code: 'TX', name: 'Texas', allowed: true },
  { code: 'VA', name: 'Virginia', allowed: true },
  { code: 'WV', name: 'West Virginia', allowed: true },
  { code: 'WI', name: 'Wisconsin', allowed: true },
  { code: 'WY', name: 'Wyoming', allowed: true },
  { code: 'DC', name: 'Washington D.C.', allowed: true },
];

/** Set of allowed state codes for O(1) lookup */
export const ALLOWED_SHIPPING_STATES = new Set<StateCode>(
  SHIPPING_STATES.filter(s => s.allowed).map(s => s.code)
);

/** Returns true if we ship hemp-derived products to the given state code */
export function canShipToState(stateCode: string): boolean {
  return ALLOWED_SHIPPING_STATES.has(stateCode as StateCode);
}

/** Returns the blocked reason for a state, or null if shipping is allowed */
export function getShippingBlockReason(stateCode: string): string | null {
  const state = SHIPPING_STATES.find(s => s.code === stateCode);
  if (!state || state.allowed) return null;
  return (
    state.blockedReason ?? 'We are unable to ship to this state at this time.'
  );
}

# Launch-Day Runbook — 2026-04-20 @ 4:20 PM CT

Operating procedure for taking rushnrelax.com live. Follow in order. Do not skip steps.

---

## T-24h — Monday 4/19 evening

### Pre-flight checks

- [ ] All open launch-blocking PRs merged to `main`
- [ ] `main` deployed successfully to Vercel production
- [ ] Firebase production project (`rush-n-relax`) has:
  - [ ] Firestore rules deployed (`firebase deploy --only firestore:rules`)
  - [ ] Functions deployed (`firebase deploy --only functions`)
  - [ ] Places API enabled in GCP console
  - [ ] `GOOGLE_PLACES_API_KEY` set as a Functions secret
- [ ] All 3 locations' Place IDs verified in `src/constants/locations.ts`
- [ ] Legal pages live: `/terms`, `/privacy`, `/shipping`
- [ ] AgeChecker dashboard: `rushnrelax.com` domain added, webhook URL set, test mode OFF
- [ ] Clover sandbox keys received and swapped in (assumes Monday delivery)

### Final env var audit

```bash
vercel env ls | grep -E "AGECHECKER|CLOVER|FIREBASE|GOOGLE"
```

Expected in Production:

- `NEXT_PUBLIC_AGECHECKER_API_KEY`, `NEXT_PUBLIC_AGECHECKER_TEST_MODE=false`
- `AGECHECKER_SECRET`, `AGECHECKER_TEST_MODE=false`
- `CLOVER_MERCHANT_ID`, `CLOVER_API_KEY`, `CLOVER_WEBHOOK_SECRET`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

### Smoke test on preview (not production yet)

- [ ] Add product to cart
- [ ] Pickup flow: select location → checkout → AgeChecker test modal → pass → redirected to stub
- [ ] Shipping flow: blocked state (Idaho) disabled in dropdown; allowed state (TN) proceeds
- [ ] Contact form submits without error
- [ ] Each location page loads Google reviews

---

## T-2h — Tuesday 4/20, 2:20 PM CT

### Freeze

- [ ] Announce freeze in any dev channels — no merges until after launch
- [ ] Final `main` deploy completed, production healthy

### DNS cutover prep

- [ ] Cloudflare dashboard open, ready to flip nameservers / A records to Vercel
- [ ] TTL already lowered to 300s (do this 24h earlier if possible)
- [ ] Verify Vercel custom domain `rushnrelax.com` configured, SSL cert issued

---

## T-0 — 4:20 PM CT: GO LIVE

1. **Flip DNS** — point `rushnrelax.com` + `www.rushnrelax.com` to Vercel
2. **Verify propagation** (typically <5 min with low TTL):
   ```bash
   dig rushnrelax.com +short
   curl -I https://rushnrelax.com
   ```
3. **Smoke test production** (use incognito, real ID):
   - [ ] Homepage loads, no console errors
   - [ ] Place a real $5 test order through AgeChecker → Clover sandbox
   - [ ] Webhook lands, order status → `paid` in Firestore
   - [ ] Confirmation email sent (check `outbound-emails` collection)

---

## T+30min — Post-launch watch

- [ ] Monitor Vercel function logs: `vercel logs --follow`
- [ ] Monitor Firebase Functions logs: `firebase functions:log --follow`
- [ ] Check Cloudflare analytics for unusual 4xx/5xx rates
- [ ] Verify AgeChecker dashboard shows real verifications arriving
- [ ] Verify Clover dashboard shows real transactions

---

## Rollback Plan

### Scenario A: Site broken but DNS OK

- Revert last commit on `main`, redeploy:
  ```bash
  git revert <sha> && git push origin main
  ```
- Or in Vercel dashboard: **Deployments → previous healthy deploy → Promote to Production**

### Scenario B: DNS cutover itself failed

- Revert Cloudflare DNS to previous target (keep a screenshot of original records before flipping)

### Scenario C: Payments broken

- Set `CLOVER_MERCHANT_ID=""` via `vercel env rm` — checkout auto-falls-back to `/checkout/stub` with a message
- Orders still record as `pending` — no lost data

### Scenario D: AgeChecker down

- Set `NEXT_PUBLIC_AGECHECKER_TEST_MODE=true` in production (emergency only) — customers can still check out, but no ID verification. **Document the window, disable new orders if compliance risk.**

---

## Known Gaps (accepted for launch)

Post-launch work tracked in milestone #1 (issues #180–#190). Not blockers:

- Design handoff items (typography refinements, component polish)
- Role-change confirmation dialog (#178)
- Inventory cascade toast (#179)

---

## Emergency Contacts

- Vercel status: https://www.vercel-status.com
- Firebase status: https://status.firebase.google.com
- Cloudflare status: https://www.cloudflarestatus.com
- AgeChecker support: via dashboard
- Clover merchant support: (use merchant account phone)

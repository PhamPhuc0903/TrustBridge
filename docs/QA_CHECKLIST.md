# TrustBridge v1.1 Windows acceptance and regression checklist

The following are **verification tasks**, not a claim that the application has already passed integration testing.

## Environment

- [ ] Docker Compose PostgreSQL becomes healthy.
- [ ] `npm install` completes, `npm run db:generate`, `npm run db:push`, `npm run db:seed` succeed.
- [ ] `npm run build` succeeds for both client and server.
- [ ] `npm run test` succeeds for policy unit tests and source contracts.
- [ ] React responds at 5173, health responds at 8000, **ready connects to PostgreSQL**, Swagger responds at 8000/docs.
- [ ] No JavaScript console errors or missing CSS asset requests.

## Identity and privacy

- [ ] Investor can sign in and search/filter public feed.
- [ ] Startup cannot call investor feed (`403`).
- [ ] Blind feed JSON never contains brand, founder, secret or private details.
- [ ] Investor without grant cannot call details endpoint (`403`).
- [ ] Startup cannot read or modify another startup's pitch.
- [ ] A red conflict cannot be approved without explicit acknowledgement (`409`).
- [ ] Approved grant unlocks details only to the approved investor.
- [ ] Duplicate access request is rejected (`409`).

## Pitch and AI

- [ ] Startup Mới creates a pitch and sees Draft status.
- [ ] AI review before simulated payment is rejected (`409`).
- [ ] After payment, AI review produces a published anonymous feed item.
- [ ] Edit a pitch; AI review must run again, and previously approved Investors lose access until another Request Access is approved.
- [ ] Try an eleventh update in the same month; backend rejects (`409`).

## Escrow

- [ ] Deal creation without grant is rejected (`403`).
- [ ] Milestone proportions other than 100% are rejected (`400`).
- [ ] Startup submits KPI evidence only after earlier KPIs have been paid.
- [ ] Investor can release their own deal's KPI only if evidence is approved-ready.
- [ ] Other investors cannot release that deal's KPI (`403`).
- [ ] Releasing the same milestone twice returns (`409`).
- [ ] Ledger entries satisfy escrow debit + platform fee + startup net = 0.
- [ ] Fees are 5% of disbursed amount, displayed in USD but stored as integer cents.

## UX

- [ ] Desktop 1440px and laptop 1024px: no horizontal overflow, readable data cards.
- [ ] Mobile 390px: sidebar drawer, cards, form and modals remain usable.
- [ ] Loading, empty, API error and duplicate action errors have meaningful text.
- [ ] Switching role refreshes the accessible nav and dashboard.
- [ ] Admin Reset on localhost recreates seed data and **invalidates old JWT tokens**.

## Release limitations

No real bank payment, escrow holding, eKYC/AML, e-NDA, encrypted private file service or LLM evaluation has been tested. These services do not exist in this classroom release.


## Reproducible Windows regression run

1. Start Docker Desktop, run `start_windows.bat` and wait for WEB + API status.
2. In a second window run `verify_windows.bat`, type `TEST`. **All demo data is reset.**
3. Record the output from build, `npm run test`, API scenario as PASS/FAIL; do not present tests as passing until the commands finish.
4. Manually open both investor and startup dashboards and test at desktop/mobile viewports.
5. Inspect DevTools Network to verify `/pitches/feed` does not return brand, founder, secret, privateDetails.
6. Do a final Admin Reset before presenting if test actions remain.

# TrustBridge classroom presentation script

| Time | Role | Action | Evidence to show |
|---|---|---|---|
| 0:00 | Visitor | React login and select Investor Hải | Role-based product onboarding and safety notice |
| 0:45 | Investor Hải | Open investment feed | Trust Score, funding, equity; no brand name or founder |
| 1:30 | Investor Hải | Request access to TeaLab (`ST-8821`) | Access Request created in PostgreSQL |
| 2:15 | Startup TeaLab | Open access requests | Conflict shield flags RoyalTea holdings RED_ALERT |
| 3:00 | Startup TeaLab | Approve with explicit risk acknowledgement | Backend creates AccessGrant; audit event |
| 3:45 | Investor Hải | Open TeaLab private details | Protected API now returns sensitive details |
| 4:30 | Investor Hải | Open `ESC-904` | 3 KPI, 30/40/30 allocation and 5% fee |
| 5:15 | Investor Hải | Approve KPI 2 | $80,000 gross, $4,000 fee, $76,000 net (mock) |
| 6:00 | Admin | Open audit logs | Records of access and payout actions |

**Alternative flow:** Investor Quân requests TeaLab: no overlap in mocked holdings, and startup may approve without red warning.

**Creation flow:** `new@demo.test`: create first pitch (DRAFT), record $10 simulated payment, submit for MOCK AI, then see it on investor feed.

**Never claim:** the AI has independently verified facts, eKYC is real, the application actually holds funds, escrow complies with banking regulation, or money has been transferred.

**Contingency plan:** Before the presentation, test the above against localhost. If demo state differs, sign in as Admin and use Reset on localhost, then sign in again. Keep one pre-recorded screen capture as presentation fallback if Docker/Internet is unavailable at the venue.

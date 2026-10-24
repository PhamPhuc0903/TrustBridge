# REST API contract — TrustBridge v1.1

Base URL in development: `http://localhost:8000/api/v1`. React uses `/api/v1` through Vite proxy. Authentication: `Authorization: Bearer <JWT>`.

## Identity & system

| Method | Endpoint | Permission | Response |
|---|---|---|---|
| POST | `/auth/login` | Public demo | `access_token`, `user` |
| GET | `/me` | Authenticated | `id`, `name`, `email`, `role`, `ekyc_verified` |
| GET | `/health` | Public | `status`, `stack`, `ai`, `escrow` |
| GET | `/demo/accounts` | Demo only | Seeded account identity list |

## Pitch, AI and privacy

| Method | Endpoint | Permission | Notes |
|---|---|---|---|
| GET | `/pitches/feed` | Verified Investor | **Allowlisted anonymous data** |
| GET | `/startups/me/pitches` | Startup | Own profiles only |
| POST | `/pitches` | Startup | One pitch per owner |
| PATCH | `/pitches/:id` | Owner Startup | Updates version, requires fresh AI review |
| POST | `/pitches/:id/demo-pay` | Owner Startup | Dummy $10 profile fee |
| POST | `/pitches/:id/submit` | Owner Startup | Mock / HTTP AI review |
| POST | `/pitches/:id/progress-updates` | Owner Startup | Limit 10 per month |
| GET | `/pitches/:id/progress-updates` | Owner Startup / Admin | History of updates |
| GET | `/pitches/:id/details` | Owner, Admin, Investor with grant | Contains private fields |

`POST /pitches` body (example):

```json
{
  "industry": "EdTech / AI",
  "industry_tags": ["edtech", "saas"],
  "target_usd": 85000,
  "equity_percent": 12,
  "brand_name": "Example Project",
  "founder_name": "Demo Founder",
  "secret": "Confidential strategy",
  "private_details": "Pitch details to be reviewed"
}
```

## Access control

| Method | Endpoint | Permission | Notes |
|---|---|---|---|
| POST | `/pitches/:id/access-requests` | Verified Investor | Triggers conflict check, unique investor/pitch |
| GET | `/startups/me/access-requests` | Startup | Own pitch's incoming requests only |
| POST | `/access-requests/:id/decision` | Owner Startup | `APPROVE` or `REJECT`; RED_ALERT requires acknowledgement |

Example approve request:

```json
{"action":"APPROVE","acknowledge_conflict":true,"note":"Đã rà soát danh mục sở hữu"}
```

`acknowledge_conflict` must be true to approve a RED_ALERT request, even if frontend skips a dialog.

## Deals & KPI

| Method | Endpoint | Permission | Notes |
|---|---|---|---|
| GET | `/deals` | Authenticated | Returns only participant's deals; all for Admin |
| POST | `/deals` | Granted Investor | Total milestone shares = 100% |
| GET | `/deals/:id` | Participants/Admin | Deal + milestone list |
| POST | `/milestones/:id/evidence` | Owner Startup | Previous milestones must be paid |
| POST | `/milestones/:id/approve-and-release` | Deal Investor/Admin | Transaction + unique payout + ledger |
| GET | `/admin/audit` | Admin | Last 50 audit events |
| POST | `/demo/reset` | Admin, localhost only | Destructive demo reset |

`POST /deals` body:

```json
{
  "pitch_id": "ST-8821",
  "committed_usd": 60000,
  "milestones": [
    {"target":"Hoàn thiện MVP","allocation_percent":30},
    {"target":"Đạt KPI doanh thu","allocation_percent":40},
    {"target":"Ký thỏa thuận B2B","allocation_percent":30}
  ]
}
```

Amounts in API responses are in **minor currency units (USD cents)**, e.g. `8000000` means `$80,000`. The frontend `money()` helper performs the divide-by-100 formatting. The field `money_mode` is `SIMULATION_ONLY`.

## Common response behavior

- `400` DTO validation error, invalid milestone percentages / capital limits.
- `401` missing/invalid JWT.
- `403` role/ownership/grant violation.
- `404` resource not found.
- `409` duplicated request, duplicate payout, invalid state transition, quota exceeded.
- `503` unavailable AI service or invalid AI response.

All errors return JSON with `detail` and `statusCode`. Swagger at `/docs` provides interactive endpoint descriptions.


## v1.1 hardening notes

- `GET /ready` performs a live PostgreSQL `SELECT 1` probe; do not confuse it with the static `GET /health` identity check.
- `PATCH /pitches/:id` creates a new `DRAFT` revision. Previous access grants/requests are invalidated atomically, and Investor access remains unavailable until new AI approval and startup grant.
- The public AI summary is composed server-side from approved public fields; model-returned narrative is never automatically sent in the anonymous feed.
- JWT contains per-user auth version; Admin demo reset invalidates older sessions.
- `POST /demo/reset` is **destructive** and restricted to Admin on localhost.
- All demo fees, deposits and payouts are simulated.

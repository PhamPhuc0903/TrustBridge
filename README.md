# TrustBridge — Full-stack Investment Workspace (Windows Final v1.1)

**A complete classroom demonstration of a privacy-first, two-sided early-stage investment platform.** This repository contains **both frontend and backend**, not just an API sample.

> **IMPORTANT:** AI ratings, eKYC verification, profile payments, escrow deposits, disbursements and company information in the seeded dataset are **simulated and fictional**. This is a product demonstration for BUS1125, not an investment service or payment platform. Do not deploy this repository to the public Internet.

## Technology (fixed)

| Layer | Technology |
|---|---|
| Frontend | **React 18 + TypeScript + Vite + React Router + Lucide**, custom responsive CSS |
| Backend | **NestJS + TypeScript**, REST endpoints, validation, JWT + RBAC, Swagger |
| Database | **PostgreSQL 16 + Prisma ORM** |
| AI | Provider adapter: deterministic MOCK by default; replaceable HTTP service |
| Escrow | Transaction-backed **simulator** (no real funds) |
| Dev environment | Docker Compose for PostgreSQL; npm workspaces; Vite proxy |

The project's original HTML design reference and BUS1125 business-plan material provided the core domain: 4-stage workflow, 3-layer privacy model, 10 updates/month, $5–$10 pitch fee (demo uses $10) and 5% escrow fee. Extended future-facing ideas such as SPV, e-NDA, advisor marketplace, payment gateway, private object storage, and real eKYC **are intentionally outside the live MVP**.

## Quick start — Windows (recommended local release)

Prerequisites: **Node.js 20+** (22 recommended), **Docker Desktop** running, Internet to install npm packages and the PostgreSQL image.

1. Extract the project ZIP to a normal folder (not inside another ZIP).
2. Start **Docker Desktop**, then double-click **`start_windows.bat`** from the project root. It checks ports 8000/5173, starts PostgreSQL, installs packages, generates the Prisma client, synchronizes the schema, seeds accounts, **builds frontend/backend**, runs unit/source checks, then starts the web and API. The first launch needs Internet for npm and the PostgreSQL Docker image.
3. Open **http://localhost:5173** in the browser. Backend Swagger is **http://localhost:8000/docs**.
4. To verify complete API flows, open a **second** command window and double-click **`verify_windows.bat`**. Confirm `TEST` when asked. **It resets the demo database before and after verification**. Do this before presenting, not in the middle of a live demo.

**Manual PowerShell commands** from project root:

```powershell
Copy-Item server/.env.example server/.env
# Change JWT_SECRET inside server/.env to any unique 32+ character secret.
docker compose up -d --wait
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

The script copies `.env.example` if `.env` is missing. Windows preflight detects ports occupied by a previous FastAPI/NestJS/Vite instance instead of accidentally connecting to it. For classroom localhost only, its example secret is acceptable as a temporary development default; **never use the sample secret or demo users on an Internet-facing host**.

## macOS / Linux

```bash
./start_unix.sh
```

Or use the same manual commands as above (`cp server/.env.example server/.env`).

**Ports:**

- `http://localhost:5173` — React frontend (Vite hot reload)
- `http://localhost:8000` — NestJS API (after `npm run build`, NestJS can also serve the built React site here)
- `http://localhost:8000/docs` — Swagger/OpenAPI
- `http://localhost:8000/api/v1/health` — API identity (`NESTJS_POSTGRES_PRISMA`)
- `http://localhost:8000/api/v1/ready` — PostgreSQL live readiness check
- PostgreSQL host `127.0.0.1:55432` (container port 5432)

Port **55432** is used on Windows to avoid collisions with an existing local PostgreSQL service or an older TrustBridge Docker project. If it is occupied, change `127.0.0.1:55432:5432` in `docker-compose.yml` and the corresponding `localhost:55432` in `server/.env` to another free host port. The container still listens on 5432.

**If `localhost:8000` shows an old v0.1 screen:** terminate the old server that occupied port 8000. Use **port 5173 for the React UI** and **port 8000 for API/Swagger**, then hard refresh `Ctrl+F5`.

## Sample accounts

Every seeded demo user uses **`Demo123!`**. Choose an account on the login screen or enter credentials yourself.

| Email | Role | Demo action |
|---|---|---|
| `hai@demo.test` | Investor | Browse Blind Feed, request TeaLab, approve SpeakMate KPI 2 |
| `quan@demo.test` | Investor | Request TeaLab without conflict |
| `tea@demo.test` | Startup | Inspect red conflict alert and decide who sees TeaLab |
| `speak@demo.test` | Startup | See SpeakMate AI and submit KPI evidence |
| `new@demo.test` | Startup | Create a completely new pitch → simulated $10 payment → AI MOCK review |
| `admin@demo.test` | Admin | View audit logs and reset data (localhost only) |

### Presentation script (approximately 5–8 minutes)

1. Open React login; select **Investor Hải**. On Overview show the metrics and the 4-stage flow. In **Khám phá dự án**, point out that the TeaLab identity is intentionally invisible. Show DevTools Network to demonstrate that private fields do **not** appear in `/api/v1/pitches/feed`.
2. Click **Yêu cầu truy cập** for `ST-8821`. Switch user to **Startup TeaLab**. Go to **Yêu cầu nhà đầu tư**; the system flags Hải's RoyalTea holdings as a red conflict. Acknowledge the warning to grant access (or reject and discuss privacy first).
3. Switch back to **Investor Hải**. A granted pitch can now be opened via a **separate protected API**, showing founder, brand and confidential information.
4. Open **Danh mục & Escrow** and inspect `ESC-904` for SpeakMate AI: KPI 1 already paid, KPI 2 awaits approval, KPI 3 is locked. Approve KPI 2, see gross $80,000, fee $4,000, net $76,000 (**simulated**).
5. Try the same payout endpoint again via Swagger; the backend should return **409**, with no second payout ledger entry.
6. For a full creation demo, choose **Startup Mới** → create pitch → simulated $10 fee → AI Review → investor feed.
7. Log in Admin → Audit log → optionally Reset. Reset invalidates every existing JWT via per-user `authVersion`; log in again.

See [`docs/DEMO_SCENARIO.md`](docs/DEMO_SCENARIO.md) for a click-by-click table.

## Features

**Investor workspace**
- Role-specific overview dashboard: pitch count, grants, deals, simulated released funds.
- Blind pitch feed with keyword search, industry filter and sort by AI Score/capital.
- Request access to restricted pitches and track request status.
- Protected detailed profile modal (only when AccessGrant exists).
- Create simulated deal after approval, with default KPI allocation 30% / 40% / 30%.
- Review submitted evidence and approve simulator payouts.

**Startup workspace**
- Company/pitch dashboard, private content, AI score breakdown.
- Create/edit pitch (one per Startup) with DTO validation; editing revokes old access grants/requests and requires a new AI review.
- Simulated $10 profile fee, MOCK AI review and publication.
- Add up to 10 progress updates per calendar month and display history.
- Review identity/holdings on access requests, with conspicuous conflict warnings.
- Explicit warning acknowledgement before granting access on a RED_ALERT request.
- Submit milestone evidence after previous milestones are completed.

**Admin workspace**
- Basic platform summary and recent audit logs.
- Search last 50 audit events.
- Reset seeded demo data **only from localhost**.

**Security and correctness included in demo**
- Password hashes with bcrypt; bearer JWT; NestJS AuthGuard and ownership checks.
- Blind Feed builds DTO from **explicit public allowlist**, never uses CSS blur for security.
- Access request unique per pitch+investor and grant unique per investor+pitch.
- AI conflict warning acknowledgement enforced by backend for RED_ALERT.
- Updates limit enforced atomically at database level with current month tracking (Asia/Ho_Chi_Minh).
- Escrow milestone payment uses Prisma transaction + unique payout and 3 ledger entries (debit escrow, fee credit, startup credit).
- Sensitive action audit logs; no private data returned from blind API.
- Frontend network errors, loading, empty state, filters, dialogs, responsive layout.

## File layout

```text
trustbridge-fullstack/
├── client/
│   ├── src/
│   │   ├── components/      # App shell/sidebar, badges, modal, cards, states
│   │   ├── context/         # Authentication, toast notifications
│   │   ├── lib/api.ts       # Typed HTTP client, error handling, formatting
│   │   ├── pages/           # Login, Home, Discover, Pitch, Access, Deals, Audit
│   │   ├── types.ts         # Shared API data shapes for UI
│   │   ├── main.tsx         # Routes + role-based navigation
│   │   └── styles.css       # Fully responsive design system
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── server/
│   ├── prisma/schema.prisma
│   ├── prisma/seed.ts
│   ├── src/               # NestJS API, auth, AI adapter, service, seed
│   ├── tests/             # Jest rules, static contract, smoke scenario
│   └── .env.example
├── docs/
├── docker-compose.yml
├── start_windows.bat
├── start_unix.sh
└── package.json         # npm workspaces
```

## Build and verification

```bash
npm run build        # Compile React TypeScript/Vite and NestJS
npm run test         # Jest backend unit tests + static API/frontend contract checks
node server/tests/smoke.cjs    # Only after running API + PostgreSQL; mutates demo DB
```

After build, stop `npm run dev`, then run `npm start`: the NestJS server on port 8000 also serves the React SPA from `client/dist`. The Vite dev server is not required for this mode. **Do not attempt `npm start` before `npm run build`**.

### Testing status of this distribution

Source-level checks have been executed using TypeScript parser and zero-dependency contract tests. **This delivery has not been fully built or run end-to-end against PostgreSQL in the generating environment**, because external npm package retrieval and Docker runtime are unavailable there. You should run `npm install`, `npm run build`, `npm run test` and the smoke test on your own machine; any runtime issue can then be diagnosed from the exact terminal error.

## Connecting Hoàng's AI

The adapter lives in `server/src/ai.ts`. Default `.env`: `AI_MODE=mock`. For a real AI HTTP service, provide `AI_MODE=http`, `AI_BASE_URL`, `AI_SERVICE_TOKEN`, and implement:

- `POST /review-pitch` — response with `pitch_id`, `status`, `ai_trust_score`, `agent_breakdown`, `public_ai_summary`, `is_spam_or_violated`, `model_version`.
- `POST /conflict-check` — response with `has_conflict`, `risk_level`, `similarity_percent`, `warning_message`, `model_version`.

Backend validates AI responses and times out after 5 seconds. AI does not have permission to create grants or disburse funds.

## Explicitly out of scope (not implemented)

Real eKYC/AML, real bank escrow, digital signatures or legally enforceable e-NDA, SPV/cap table, business data marketplace, real AI LLM evaluation, upload to private object storage, payment receipts, chat, multi-organization membership, investment suitability, production observability, secure refresh-token authentication and compliance auditing. The attached business plan describes some of these as **future product ambitions**; the UI does not represent them as delivered features.

**Project status:** Complete source for a serious classroom MVP, not production software. Never use it to handle financial assets or real personal/company secrets.


## Windows final QA and real test status

The application is built for a **local classroom demonstration only**. There is no real KYC, bank account, bank escrow, money transfer, contract signature or legally valid SPV integration. `DEMO` badges are intentional. Avoid real personal records and real financial information.

**Two different verification modes**:

```powershell
# Zero-dependency contract / syntax / mocked service runtime checks:
node server/tests/contract-check.cjs
node scripts/source-check.cjs
node scripts/offline-business-tests.cjs

# After npm install + Docker PostgreSQL + npm run dev:
npm run build       # TS typecheck, Vite bundling, Nest production compilation
npm run test        # Jest policies + static and offline checks
npm run test:api    # DESTRUCTIVE: reset seed, run live API scenario, restore seed
```

**`verify_windows.bat` is destructive to demo-only data** and will ask for `TEST` explicitly. The test exercises authentication, privacy of Blind Feed, role restrictions, conflict acknowledgement, milestone payouts, double-release prevention, 10/month updates, pitch publishing and pitch-revision grant revocation. It restores the original sample scenario in a `finally` block.

**Important validation limit:** This delivery environment has Node.js and TypeScript but no Docker daemon or access to the npm registry. Syntax/source contract checks and mocked-service runtime checks were run here; a real `npm run build`, Jest run and PostgreSQL HTTP scenario **must still be executed on your Windows computer**. Do not claim the latter passed until the Windows verification prints success. See [`docs/VERIFICATION_REPORT.md`](docs/VERIFICATION_REPORT.md).

### Troubleshooting

- **Old, unstyled FastAPI page on port 8000:** close the previous server; open the React frontend on **port 5173**. Use `scripts/check-ports.ps1` to identify programs holding 8000/5173.
- **`npm install` fails:** verify Internet connectivity and retry; the ZIP does not contain `node_modules`.
- **`docker compose up` fails:** start Docker Desktop (Linux containers mode) and check port 55432.
- **`/ready` returns 500:** database connection not ready; inspect `docker compose logs postgres` and `server/.env`.
- **Browser opens but API operations fail:** confirm terminal shows both `[API]` and `[WEB]`, inspect browser Network tab, and check Swagger at `/docs`.
- **After Admin Reset, you see authentication errors:** reset intentionally revokes every token; log out and sign in again.
- **Back up user-created demo content before running `verify_windows.bat`:** all entries are deliberately removed when seed is restored.

# TrustBridge Windows Final v1.1 — Verification report

**Release target:** Windows 10/11 laptop, Node.js >= 20, Docker Desktop, local React/Vite + NestJS + PostgreSQL 16 + Prisma. No external publishing.

## Tests that actually ran in the delivery environment

| Check | Result | Tool | Evidence |
|---|---|---|---|
| TypeScript/TSX syntax and local imports | **PASS** | `node scripts/source-check.cjs` | Parsed 25 TypeScript files, resolved 66 imports |
| Source/API structural contract | **PASS** | `node server/tests/contract-check.cjs` | All assertions passed |
| Offline backend business rules | **PASS** | `node scripts/offline-business-tests.cjs` | Six real service-method checks using mocked Prisma/Nest adapters |
| Node syntax of JS verification scripts | **PASS** | `node --check` | No errors |
| CSS grammar | **PASS** | `tinycss2` | Parsed 489 stylesheet rules, no parse errors |
| ZIP integrity | **PASS** | Python `zipfile.testzip()` | 53 packaged files, no corrupt entries |

The six mocked business checks exercise Blind Profile field exclusion, missing grant denial, red-conflict acknowledgement, repeat-payout rejection, transactional grant revocation on pitch edit, and public AI summary sanitization.

## Not executable in this delivery environment

**No npm registry access and no Docker binary/daemon** are available here. Therefore these checks are **NOT VERIFIED**, not "PASS":

- Full npm dependency installation;
- `npm run build` (TypeScript typechecking, Vite production build, NestJS build);
- Jest suite under installed Nest/Prisma dependencies;
- PostgreSQL migration/seed;
- End-to-end HTTP API tests with actual database;
- Browser visual/regression testing on Windows.

## How to finish verification on user's laptop

Run `start_windows.bat` first. It executes package install, Prisma, build, and unit/static checks before starting the services. Then run `verify_windows.bat` in a second terminal. That script confirms with `TEST`, exercises the live API scenario and restores demo seed.

**Never use the test/reset scripts with any real data.** This project is a teaching demonstration, not a regulated financial product.

# Bella Books

GST billing, inventory and accounting for Indian small businesses. Next.js 15 (App Router),
TypeScript strict, PostgreSQL + Prisma.

Built from the reference material in [`references/`](references/README.md). See
[`docs/SCREEN_INVENTORY.md`](docs/SCREEN_INVENTORY.md) for what every screen contains,
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how it is put together,
[`docs/PHASES.md`](docs/PHASES.md) for the build plan and
[`docs/DECISIONS.md`](docs/DECISIONS.md) for every non-obvious decision.

---

## Getting started

**No Docker required.** The database runs as an ordinary local process: `embedded-postgres`
ships the real PostgreSQL binaries and starts them under your own user account, with the data
kept in `.postgres/` inside the project.

```bash
pnpm install
```

Copy the environment file:

```bash
cp .env.example .env
```

Set `AUTH_SECRET` in `.env` to the output of:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Then start the database, create the schema and load the demo data in one step:

```bash
pnpm setup
```

Run it:

```bash
pnpm dev
```

Open the URL it prints and log in with **demo@bellabooks.test** / **demo1234**.

The database keeps running in the background between sessions. Stop it with `pnpm db:stop`,
start it again with `pnpm db:start`, and check it with `pnpm db:status`.

### ⚠️ Database safety — read this once

**This project uses port `5434`. Never point it at `5433`.**

Port 5433 on this machine is a connection pooler that **ignores both the database name and the
username**: every connection lands on the `postgres` database as superuser, which holds an
unrelated live project. `prisma db push --force-reset` against it would drop that data. See
`docs/DECISIONS.md` D-23.

Never run `--force-reset`, `migrate reset` or any `DROP` against a URL without first confirming
what is actually behind it. A connection string is not evidence of which database you reached.

### Using a different Postgres

Any PostgreSQL 14+ works. Point `DATABASE_URL` at it and skip `pnpm db:start`. A
`docker-compose.yml` is included for anyone who prefers a container — it publishes the same
port 5434, so nothing else changes.

---

## Commands

| Command | Does |
|---|---|
| `pnpm setup` | Start the database, push the schema, load demo data |
| `pnpm dev` | Development server |
| `pnpm build` | Production build (runs `prisma generate` first) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit suite |
| `pnpm db:start` / `db:stop` / `db:status` | Local Postgres, no Docker |
| `pnpm db:push` | Sync the schema without a migration |
| `pnpm db:migrate` | Create and apply a migration |
| `pnpm db:seed` | Reload the demo company |
| `pnpm db:studio` | Prisma Studio |

---

## How it is organised

```
app/(auth)        login, signup, password reset
app/(select)      company picker and the setup wizard — outside the app shell
app/(app)         everything behind a chosen company: sidebar + top bar
app/print         printable invoice preview
components/ui     primitives (button, dialog, table, …)
components/shell  sidebar, top bar, command palette
components/patterns  master-detail, filter bar, summary cards, ledger table
components/txn    transaction form, line grid, totals panel
components/print  the three A4 themes and the thermal layout
components/pdf    server-side PDF document
lib/calc          the calculation engine — pure, no I/O, heavily tested
lib/gst           GSTIN validation, state codes, place of supply
lib/filters       URL filter state, shared by server and client
lib/db            Prisma client and the tenancy guard
server/actions    server actions, one file per module
server/services   posting, balances, reports, import, verification
```

### Two-level tenancy

**Company** is the tenant — the thing you open in the company picker. **Firm** is a business
entity inside a company, with its own GSTIN, logo and invoice number series. Parties and items
are shared across the firms of a company; transactions are tagged to one firm.

This deviates from the brief, which treats the two as one concept. The reference screens settle
it: the `All Firms` filter appears on the transaction lists and on neither master list. Full
reasoning in `docs/DECISIONS.md` D-20.

### Balances are derived

Party balances, cash, bank balances and stock are **summed from `LedgerEntry` and
`StockMovement`**, never stored as editable counters. That is what makes **Verify My Data**
meaningful: it recomputes everything and reports any disagreement.

### Money

`Decimal(14,2)` at rest, `decimal.js` in memory, never a JS float. Every currency figure comes
from one pure function, `computeTransaction` in `lib/calc`. The server re-runs it on every save
and persists only its own result, so a tampered client payload cannot change an invoice's value.

### Client/server boundary

Anything exported from a `"use client"` module becomes a client reference, and a server
component that imports it crashes at request time. Shared helpers that both sides call — most
notably `readFilterParams` — live in `lib/`, never in a component file.

# Decisions log

Running record of every non-obvious technical decision. Newest last.

---

### D-01 — App name is **Bella Books** *(confirmed 2026-09-24)*
The brief shipped with a literal `[APP_NAME]`. Confirmed as **Bella Books**. It still lives in
`components/brand/` behind a single exported constant, so a later rename stays a one-line change.

### D-02 — Reference screenshots are copied into `references/`
There was no `./references` folder; the eleven images arrived as chat attachments. They now live in
the repo under descriptive names with a `README.md` mapping (`references/README.md`). They are
documentation only and are never imported by application code, so they cannot reach the bundle.

### D-03 — Layout replicated, brand not
Per the brief: we copy information architecture, screen composition, table columns, filter behaviour
and flows. We copy no name, logo, icon, illustration or colour. Our palette is teal/amber against the
reference's navy/red specifically so the two are not confusable.

### D-04 — Premium gating removed rather than reimplemented
Every crown-badged item in the references is either out of scope or ships unlocked. There is no
plan/entitlement concept in the schema. Adding one later is additive.

### D-05 — Single polymorphic `Transaction` table
Sixteen document types share numbering, party linkage, totals, tax breakup, payment allocation and
audit. Separate tables per type would duplicate all of that and make the Day Book and All Transactions
reports (both observed in ref-08) a union of sixteen queries. The cost is nullable columns for types
that do not use them, which is cheaper than the alternative.

### D-06 — Balances are derived, never stored as counters
Party balance, cash, bank and stock all sum from `LedgerEntry` and `StockMovement`. `BalanceCache`
exists only for list-screen speed and is rebuildable. This is the brief's principle 2 and it is what
makes `Verify My Data` (observed in ref-10's sidebar) meaningful rather than decorative.

### D-07 — Tax-inclusive is a per-price-field flag
Ref-03 shows `SALE PRICE: Rs 2,500.00 (incl)` alongside `PURCHASE PRICE: Rs 0.00 (excl)` on the same
item, so a single item-level boolean is wrong. The schema carries `salePriceTaxInclusive` and
`purchasePriceTaxInclusive` separately, and each invoice line can still override.

### D-08 — Bill-level discount is apportioned pro rata across lines
The brief fixes the order (line discount, then bill discount, then tax) but not the mechanism. With
mixed tax rates on one invoice, a bill discount must reduce each line's tax base proportionally or
the CGST/SGST split is wrong. Apportionment is by line taxable value; the last-paisa remainder goes to
the largest line so the lines always re-sum to the header.

### D-09 — Empty invoice-number prefixes must be legal
Ref-04 shows invoice numbers `428`–`434` with no prefix at all. `NumberSequence.prefix` is therefore
nullable/empty-allowed, and the uniqueness constraint keys on `(firmId, type, financialYear, number)`
rather than on a formatted string.

### D-10 — Negative stock is allowed by default
Ref-03 shows quantities of `-150`, `-130`, `-20`, `-3`, and ref-11 shows `Stop Sale on Negative Stock`
unchecked. The default is permissive; the setting gates a server-side validation, not a UI hint.

### D-11 — Expense categories carry a Direct/Indirect type
Ref-07 shows `Direct Expense` as a sub-label under the category name. This drives the Profit & Loss
report's split between cost of goods and operating expenses, so it is a column on
`ExpenseCategory`, not free text.

### D-12 — One filter-bar treatment across all lists
Ref-04 and ref-06 use rounded pills; ref-05 uses boxed controls with a `Between` label and labelled
Excel/Print buttons. Two treatments for one control is inconsistency in the source, not intent. We
standardise on the pill style and log it as a deviation.

### D-13 — Dashboard rounds, detail screens do not
Ref-01 shows `Rs 1,38,12,793` and `390%`; ref-04 shows `Rs 13,21,350.08` and `390.18%`. The rule is
display-level only — stored precision is always 2 dp.

### D-14 — Calculation engine is built before any consumer
Moved from the brief's phase 3 to phase 2. Building it with no UI to satisfy keeps it pure and makes
the test matrix the specification rather than a description of whatever the form happened to do.

### D-15 — Dashboard is built after reports
Moved from the brief's phase 8 to phase 10. Every dashboard figure is a report aggregate; building it
first would mean writing those queries twice and having them drift.

### D-16 — Onboarding ships without its live invoice preview in phase 1
Ref-10's wizard renders a live sample invoice beside the form, which needs the PDF/print work from
phase 6. Phase 1 ships the wizard with a static illustration and phase 6 retrofits the real preview.
Recorded now so it is a scheduled deviation rather than a surprise.

### D-17 — Server recomputes every total
The client runs `lib/calc` for instant feedback, but the server re-runs the identical pure function
and persists only its own result. Client-supplied totals are discarded, so a tampered payload cannot
change an invoice's value.

### D-18 — Tenancy enforced by a Prisma client extension, not by discipline
`firmId` injection and `deletedAt` filtering happen in one extension, with a test that enumerates the
schema and fails if any firm-scoped model is reachable without it. Hand-written `where` clauses are
the usual source of cross-tenant leaks and this removes the opportunity.

### D-19 — Godowns out of scope, but the column is reserved (confirmed 2026-09-24)
The reference firm uses godowns (a godown filter on the items list, `Estimate (Main Godown)` in item
history, `Godown management & Stock transfer` enabled in settings), but the brief never mentions them
and you confirmed the module is not needed for now.

Stock therefore derives against a single implicit location. To keep a later addition additive rather
than a destructive migration, phase 3 ships `StockMovement.godownId` as a **nullable FK** with no
`Godown` table behind it yet, and the items list hides the godown filter instead of hard-coding its
absence. Adding multi-godown later means creating the table, backfilling one default row, and
un-hiding the filter — no data rewrite.

### D-20 — Company and Firm are two levels; this deviates from the brief (confirmed 2026-09-24)
The brief's §2.1 says *"Multi-tenant by firm. Every business record belongs to a `Firm` (company)"*,
treating the two as one concept. The reference app has two, and ref-12 (the Company List) made it
explicit, so we split them.

- **Company** is the tenant — the thing you `Open` in ref-12, the isolation boundary, the owner of
  parties, items, units, categories, settings and transactions.
- **Firm** is a business entity inside a company — its own name, GSTIN, state, address, logo,
  signature and invoice number series. `Multi Firm` in ref-11 permits more than one.

**The evidence that settles it:** the `All Firms` filter is present on both transaction lists
(ref-04 Sale Invoices, ref-05 Purchase Bills) and absent from both master lists (ref-02 Parties,
ref-03 Items). So parties and items are shared across the firms of a company, while transactions are
firm-tagged. One level cannot express that — it would force parties and items to be duplicated per
firm and make "All Firms" meaningless.

**Consequences:** `companyId` on every business table and it is what the tenancy extension injects;
`Transaction.firmId` non-null; the numbering constraint keys on `(firmId, type, financialYear,
number)` so two firms can each have an invoice `1` under their own GSTIN; place of supply compares
the **firm's** state to the party's; GST reports require a single firm because GSTR-1/2/3B are filed
per GSTIN. `ARCHITECTURE.md` §3 and §4.1 carry the detail.

Where the brief says `firmId`, read `companyId` — except on transactions, which carry both.

### D-21 — Company-level sync and `.vyp` files are dropped
ref-12 shows `SYNC ON / SYNC OFF` per company, a `Browse Files (.vyp)` link and a refresh button,
because a company there is a local file that syncs to the cloud. On the web every company is
server-side and always current, so the concept has no referent. `Restore backup`, `New Company`,
search, the tabs and the last-activity line all survive; the three sync affordances do not.

### D-22 — `Companies Shared with Me` and `Accountant Access` are one feature
ref-12's second tab lists companies owned by someone else, and `Accountant Access` in the Utilities
sidebar (ref-09, ref-10) grants exactly that. They are two entry points to one
invite-a-user-to-a-company mechanism, built once in phase 12 on `CompanyMember`. Phase 1 ships the tab
with its empty state so the navigation is honest rather than absent.

### D-23 — The database lives on port 5434, never 5433 (2026-09-24)
The first `prisma db push` against the briefed default of `localhost:5433/bellabooks` found an
existing schema and refused to migrate. Investigating rather than passing `--force-reset` turned up
something important:

**Port 5433 on this machine is a connection pooler that ignores both the database name and the
username.** Connecting as `bella:bella` to `bella_books`, to `bellabooks`, or to a database name that
does not exist all land on the same place: database `postgres`, as superuser `postgres`. That
database holds an unrelated live project of the user's — a dealership incentive system with 236
deals, 955 incentive line items, 40 employees and real user accounts.

`prisma db push --force-reset`, which the CLI suggested, would have dropped all of it.

Consequences, all non-negotiable:
- `docker-compose.yml` publishes Postgres on **5434**, with database `bella_books`, container
  `bella-books-db` and volume `bella-books-pgdata` — no name collides with anything already present.
- `.env.example` ships the 5434 URL. Nothing in this project may point at 5433.
- Destructive database flags (`--force-reset`, `migrate reset`, `DROP`) are never run against a URL
  without first confirming what is actually behind it. The pooler proved that a connection string is
  not evidence of which database you reached.

### D-24 — The database runs without Docker (2026-09-24)
Docker Desktop would not start its engine on this machine, and the user could not run the app
locally because of it. Requiring Docker for a development database is a choice, not a necessity.

The project now uses `embedded-postgres`, which ships the official PostgreSQL binaries and runs
them as an ordinary user process — no daemon, no container, no admin install. `scripts/db.ts`
starts, stops and reports on it; the data directory is `.postgres/` inside the project and is
gitignored. `docker-compose.yml` stays as an alternative for anyone who prefers a container, on
the same port 5434, so nothing else in the project changes either way.

Verified live: PostgreSQL 18.4, schema pushed, demo data seeded, and `postgres.exe` runs
independently of the script that started it, so it survives between sessions.

### D-25 — `readFilterParams` lives in `lib/`, not in the filter-bar component
It was exported from `components/patterns/filter-bar.tsx`, which carries `"use client"`. Every
server page and route handler called it, and Next.js refused at request time:
*"Attempted to call readFilterParams() from the server but readFilterParams is on the client."*

This compiled and type-checked cleanly — it is a runtime framework boundary, not a type error —
so only actually running the app surfaced it. It affected the dashboard, every list screen,
every report and three export routes.

Shared helpers now live in `lib/filters/`, and the client file deliberately does **not**
re-export them: a re-export from a `"use client"` module is still a client reference, so it
would reintroduce the same crash for anyone importing through it.

### D-26 — Auth derives its origin from the request
`.env` pinned `NEXTAUTH_URL` to `http://localhost:3000`, so on any other port Auth.js redirected
to 3000 and the browser blocked it as a cross-origin request. The variable is gone; with
`AUTH_TRUST_HOST=true` the origin comes from the incoming request, which is also what is wanted
behind a proxy in production. `NEXT_PUBLIC_APP_URL` remains, but only for building shareable
invoice links.

### D-27 — Tax summary and totals stack rather than sit side by side
On the printed invoice the tax summary carries seven columns once CGST and SGST are split. At
half the page width it overflowed its grid cell and printed on top of the totals block. The tax
summary now takes the full width with the totals right-aligned beneath it, which holds at any
number of tax rows.

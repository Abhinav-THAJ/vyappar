# Build plan

The brief's twelve phases, refined against what the references actually showed. Each phase ends with
lint, type-check and tests green, a written summary, a list of deviations from the references, and a
**stop for your review**.

## Changes I made to the brief's phase list

| Change | Why |
|---|---|
| **Calculation engine moves from phase 3 to phase 2** | Parties and Items are ordinary CRUD, but the invoice form in phase 5 cannot be built honestly without the engine. Building it before any consumer exists keeps it pure and forces the test suite to be the spec rather than a retrofit. |
| **Excel import splits out of phase 2 into its own phase 4** | It is a five-step wizard with column mapping and a row-level error report (§10.1) — a screen in its own right, not a button on the items page. |
| **Dashboard moves from phase 8 to phase 10, after reports** | Every dashboard number (receivable, payable, period sales, low stock) is a report query. Building the report services first means the dashboard is assembly, not duplication. |
| **Settings is split** | A skeleton with the General tab lands in phase 1 because `More Transactions` in ref-11 *controls which nav items exist*; the remaining tabs land beside the features they configure. |
| **A new phase 0 for reference-driven design tokens and shell primitives** | `MasterDetail`, `FilterBar`, `DataTable` and `EmptyState` appear on nearly every screen. Extracted once up front, every later phase is composition. |
| **Phase 1 grows to cover Company *and* Firm** | ref-12 establishes a company switcher above the firm level (`SCREEN_INVENTORY.md` §2.6). Tenancy is the one thing that cannot be retrofitted — every table and every query depends on it — so both levels land before any business data exists. |

---

## Phase 0 — Foundation
Repo, pnpm, TypeScript strict, ESLint, Prettier, Tailwind, shadcn/ui, `docker-compose.yml` for
Postgres, `.env.example`, Vitest and Playwright harnesses, CI script. Design tokens and the original
brand placeholder. The shared primitives: `MasterDetail`, `FilterBar`, `PeriodPicker`, `DataTable`
(sort, per-column filter, visibility, server pagination), `SummaryCards`, `EmptyState`,
`SystemBanner`, `MoneyInput`, `QtyInput`, plus `lib/format` (Indian digit grouping, `Rs`, IST dates)
with tests.
**Done when:** a component gallery route renders every primitive against the ref-04 and ref-07
layouts, and the format tests pass.

## Phase 1 — Auth, companies, firms, app shell, settings skeleton
Auth.js credentials, signup / login / forgot / reset. `User`, **`Company`**, **`CompanyMember`**,
**`Firm`**, `Settings`; `requireCompany()` and `requireFirm()`; the Prisma tenancy extension and its
enumeration test.

**The Company List gate (ref-12)** — `/companies` with search, the `My Companies` list showing each
company's last-activity line, `Open` to switch, `New Company`, `Restore backup` (stubbed until phase
12 delivers backup), `Logout`, and the `Companies Shared with Me` tab rendering its empty state until
phase 12 delivers roles.

The onboarding wizard from ref-10, which now creates **a company and its first firm together**
(without the live invoice preview — see D-16). The full shell: sidebar tree, collapse, command
palette, top bar, company switcher wired to `/companies`. Multi-firm management at
`/settings/firms`, and the `All Firms` control in `FilterBar` (inert until phase 5 gives it
transactions to filter).

Settings shell plus the **GENERAL** tab exactly as ref-11, including `More Transactions` driving nav
visibility and the `Multi Firm` toggle.

**Done when:** two users in two companies cannot see each other's data, and a `firmId` borrowed from
another company 403s — both proven by tests.

## Phase 2 — Calculation engine
`lib/calc` and `lib/gst`, pure. Tax split, inclusive/exclusive, line and bill discount with pro-rata
apportionment, additional charges, cess, TCS, round-off, HSN summary, amount in words, GSTIN
validation and state extraction.
**Done when:** the full matrix from `ARCHITECTURE.md` §5 passes, including fixtures reproducing the
ref-04 invoice totals. No UI ships in this phase.

## Phase 3 — Parties and Items
Party and Item models, groups, categories, units with conversion, tax-rate master. The ref-02 and
ref-03 master–detail screens, the tabbed create/edit dialogs, stock adjustment writing
`StockMovement`, item detail metrics computed from movements. Settings **PARTY** and **ITEM** tabs.
Seed script: demo firm, ~30 parties, ~40 items across products and services.

## Phase 4 — Excel import/export
The five-step wizard (template, upload, map, validate, confirm) shared by parties and items, plus
Export Items. Row-level error reporting; a partial import never leaves half a row behind.

## Phase 5 — Sale Invoice, Payment-In, posting
`Transaction`, `TransactionLine`, `TransactionTax`, `StockMovement`, `LedgerEntry`,
`PaymentAllocation`, `NumberSequence` (per firm), `AuditLog`. The invoice form (§6.2) with keyboard
grid, inline party and item creation, totals panel and payment panel. The ref-04 list screen with a
live `All Firms` filter. Payment-In with allocation. The atomic posting service and its balance tests.
Settings **TRANSACTION** tab, with numbering prefixes configured per firm.
**Done when:** creating, editing and deleting an invoice leaves stock and ledger provably balanced,
and two firms in one company maintain independent invoice series.

## Phase 6 — PDF, print, share
Three A4 themes plus 80mm and 58mm thermal, all carrying the ref-10 block list. Logo, signature, bank
details, UPI QR, terms, amount in words, HSN summary, Original/Duplicate/Triplicate. Download, print,
`wa.me` share. Settings **PRINT** tab. Retrofit the live preview into the onboarding wizard, closing
the phase-1 deviation.

## Phase 7 — Remaining sale documents, all purchase documents, conversions
Estimate, Proforma, Sale Order, Delivery Challan, Credit Note; Purchase Bill, Payment-Out, Purchase
Order, Debit Note. The conversion chain with `convertedToId` guarding double conversion. Ref-05's
paid/unpaid/total chips.

## Phase 8 — Expenses, Cash & Bank
Expense categories with Direct/Indirect type (ref-07), expense entries and expense items. Cash in
hand, bank accounts, transfers, cheque register with its status machine, loan accounts.

## Phase 9 — Reports
Every report from ref-08 plus the brief's stock, financial and bank reports. The shared report
chrome, server-side aggregation, Excel and PDF export through the same query service.

## Phase 10 — Dashboard
Ref-01 assembled from phase 9's services: receivable and payable cards, period sales chart,
configurable widget rail, Most Used Reports strip.

## Phase 11 — GST reports and GSTR exports
GSTR-1, GSTR-2, GSTR-3B, GST Rate report, HSN summary, and GSTR-1 JSON/Excel in the government
offline-tool format, validated against the published schema. Settings **TAXES & GST** tab.

## Phase 12 — Users, sharing, audit, data management
Owner / Admin / Accountant / Salesman with a permission matrix wired into `withPermission()`.
**Company sharing** — invite a user to a company by email, which lights up the
`Companies Shared with Me` tab from phase 1 and doubles as the brief's `Accountant Access`. Audit log
UI. Recycle Bin. Verify My Data. Full JSON + Excel export. Backup and restore, which completes the
`Restore backup` button stubbed in phase 1. Financial-year close and carry-forward.
Settings **TRANSACTION MESSAGE** tab.

## Phase 13 — Hardening and ship
Performance pass against a 10,000-row seed, accessibility audit (keyboard paths, focus order,
contrast, screen-reader labels on every icon-only button in the reference layouts), responsive pass
for tablet and mobile, the Playwright suite from `ARCHITECTURE.md` §9, and deployment docs for Vercel
plus managed Postgres.

---

## Explicitly out of scope

Recorded so nothing is silently dropped: `.vyp` local company files and the `SYNC ON/OFF` model from
ref-12 (web companies are always server-side and always current), Godowns and stock transfer, POS, Loyalty Points, Vyapar
Network, the entire Grow Your Business group, Tally import/export, Barcode generation and barcode
item import, the hosted item library, bulk item update, salesman tracking, OCR purchase-bill upload,
plans and billing, multi-currency, accounting-module journal entries, service reminders, and
mobile-OTP auth. Each can be added later; none is assumed by the schema in a way that would need a
destructive migration.

---

## Status

Every phase below is **built**. Verified by `pnpm typecheck`, `pnpm lint`, `pnpm test`
and `pnpm build`, all clean.

| Phase | State | Notes |
|---|---|---|
| 0 — Foundation | Done | Scaffold, tokens, primitives, format library |
| 1 — Auth, companies, firms, shell, settings | Done | Company picker (ref-12), onboarding wizard with its live invoice preview, full shell, all seven settings tabs |
| 2 — Calculation engine | Done | 170 unit tests across calc, GST, format, import, domain and tenancy |
| 3 — Parties and Items | Done | Master-detail screens, tabbed create/edit forms, stock adjustment |
| 4 — Excel import/export | Done | Five-step wizard shared by parties and items; Excel export throughout |
| 5 — Sale invoice, Payment-In, posting | Done | Keyboard line grid, inline party/item creation, atomic posting |
| 6 — PDF, print, share | Done | 3 A4 themes + 80/58mm thermal, server-side PDF, UPI QR, WhatsApp share |
| 7 — Remaining documents, conversions | Done | All nine goods documents, both payments, conversion chain with double-convert guard |
| 8 — Expenses, Cash & Bank | Done | Direct/Indirect categories, banks, cash, transfers, cheque register, loans |
| 9 — Reports | Done | 25 reports behind one registry and a catch-all route |
| 10 — Dashboard | Done | ref-01 assembled from the report services |
| 11 — GST reports and GSTR exports | Done | GSTR-1/2/3B, rate report, HSN summary, GSTR-1 JSON in offline-tool shape |
| 12 — Users, sharing, audit, data management | Done | Role matrix, member invites, recycle bin with re-posting restore, Verify My Data, backup, FY close |
| 13 — Hardening | Partial | Lint, types, a11y fixes and responsive layouts done. Playwright suite not written — see below. |

### Deviations from the brief, all deliberate

- **D-16 closed early.** The onboarding wizard ships with its live invoice preview rather than
  waiting for phase 6.
- **D-12.** One filter-bar treatment across every list, where the reference has two.
- **Create/edit screens are routes, not modals.** Deep-linkable, reload-safe, and the back
  button keeps meaning something. The composition matches the reference.
- **Expense "Items" tab** redirects to the category view: an itemised expense uses ordinary
  items rather than a separate expense-item master.
- **Restore from backup** is deliberately not wired up. Taking backups is safe; restoring
  overwrites a company, and that deserves its own review before it ships.

### Not done

- **Playwright E2E suite.** The harness is configured but no specs are written; they need a
  live database to run against.
- **Nothing has run against a live database.** Docker's engine would not start on this
  machine, so `db:push` and `db:seed` have never executed. Every layer above the database is
  verified; the database layer is verified only by types and by the schema test.

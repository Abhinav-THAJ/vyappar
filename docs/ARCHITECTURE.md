# Architecture

Companion to `SCREEN_INVENTORY.md`. This document fixes the folder structure, the data model and the
critical flows before any application code is written.

---

## 1. Stack

Exactly as briefed, with versions pinned at install time.

| Concern | Choice |
|---|---|
| Framework | Next.js 15, App Router, React 19, TypeScript `strict` |
| DB / ORM | PostgreSQL 16 + Prisma |
| Auth | Auth.js (NextAuth v5), credentials provider, bcrypt |
| UI | Tailwind CSS + shadcn/ui + lucide-react |
| Forms | React Hook Form + Zod (schemas shared client/server) |
| Tables | TanStack Table, server-side pagination |
| Mutations | Server Actions; Route Handlers only for PDF, exports, webhooks |
| Client cache | TanStack Query where live updates matter |
| Charts | Recharts |
| PDF | `@react-pdf/renderer`, server-side |
| Excel | SheetJS (`xlsx`) |
| Money | Prisma `Decimal` at rest, `decimal.js` in memory — never a JS float |
| Dates | `date-fns` + `date-fns-tz`, `Asia/Kolkata` |
| Tests | Vitest (logic), Playwright (flows) |
| Tooling | ESLint, Prettier, pnpm, `docker-compose.yml` for Postgres, `.env.example` |

---

## 2. Folder structure

```
.
├─ app/
│  ├─ (auth)/                      login, signup, forgot/reset password
│  ├─ (select)/companies/          Company List gate (ref-12) + /new
│  ├─ (onboarding)/onboarding/     first-run company+firm wizard (ref-10)
│  ├─ (app)/                       authenticated shell: sidebar + top bar
│  │  ├─ layout.tsx                resolves session + active company + firm, renders shell
│  │  ├─ dashboard/
│  │  ├─ parties/                  list, [id], groups
│  │  ├─ items/                    products, services, categories, units, [id]
│  │  ├─ sale/                     invoices, estimates, proforma, orders,
│  │  │                            challans, credit-notes, payments-in
│  │  ├─ purchase/                 bills, orders, debit-notes, payments-out
│  │  ├─ expenses/
│  │  ├─ cash-bank/                cash, banks, transfers, cheques, loans
│  │  ├─ reports/                  one folder per report
│  │  ├─ settings/                 general, transaction, print, tax, party, item, firms, users
│  │  └─ utilities/                import-items, import-parties, export,
│  │                               verify-data, recycle-bin, fy-close
│  ├─ api/
│  │  ├─ auth/[...nextauth]/
│  │  ├─ pdf/[type]/[id]/          @react-pdf streams
│  │  └─ export/[kind]/            xlsx / json downloads
│  └─ print/[type]/[id]/           printable HTML preview
├─ components/
│  ├─ ui/                          shadcn primitives
│  ├─ shell/                       Sidebar, TopBar, CommandPalette, CompanySwitcher, FirmFilter,
│  │                               SystemBanner
│  ├─ data-table/                  DataTable, ColumnFilter, Toolbar, Pagination, EmptyState
│  ├─ patterns/                    MasterDetail, FilterBar, PeriodPicker, SummaryCards
│  ├─ forms/                       PartyPicker, ItemPicker, MoneyInput, QtyInput, GstinInput,
│  │                               DatePicker, StateSelect, TaxRateSelect
│  ├─ txn/                         TransactionForm, LineItemGrid, TotalsPanel, PaymentPanel
│  └─ pdf/                         themes/{classic,modern,compact}.tsx, thermal.tsx, blocks/
├─ lib/
│  ├─ calc/                        PURE. tax, discount, totals, roundoff, words, hsn. No I/O.
│  ├─ db/                          prisma client singleton, repositories, tenancy helpers
│  ├─ validators/                  Zod schemas, one file per module
│  ├─ format/                      inr(), indianDigits(), dateIST(), amountInWords()
│  ├─ gst/                         gstin parsing/validation, state codes, place of supply, GSTR shaping
│  ├─ numbering/                   NumberSequence allocation
│  ├─ fy/                          financial-year maths
│  └─ auth/                        session helpers, requireCompany(), requireFirm(), permissions
├─ server/
│  ├─ actions/                     one file per module, all 'use server'
│  ├─ services/                    transaction posting, stock, ledger, payments, reports
│  └─ guards/                      withFirm(), withPermission() wrappers
├─ prisma/                         schema.prisma, migrations/, seed.ts
├─ tests/                          unit/, e2e/
├─ docs/
└─ references/
```

---

## 3. Multi-tenancy — two levels

Per `SCREEN_INVENTORY.md` §2.6, the references establish **Company** and **Firm** as distinct things.
The brief treats them as one word; we split them. This is deviation **D-20**.

```
User ──< CompanyMember >── Company ──< Firm
                              │          └─ name, GSTIN, state, address, logo,
                              │             signature, invoice numbering
                              ├──< Party, Item, Unit, Category, ...   (company-level, shared)
                              └──< Transaction  ── firmId (required)  (firm-tagged)
```

- **Company** is the **tenant**. It is the thing you `Open` in ref-12, and the isolation boundary.
- **Firm** is a business entity inside a company. A company always has at least one; `Multi Firm`
  (ref-11) simply permits more.
- **Masters are company-level.** Parties, items, units and categories are shared by every firm in the
  company — inferred from the `All Firms` filter appearing on the transaction lists (ref-04, ref-05)
  and on neither master list (ref-02, ref-03).
- **Transactions are firm-tagged.** `Transaction.firmId` is non-null. Invoice numbering, GSTIN, logo
  and print identity all come from the firm, not the company.

### 3.1 Enforcement

**Rule: no query reaches Prisma without a `companyId` in its `where` clause.**

1. **`requireCompany()`** — every server action and page loader starts here. It reads the Auth.js
   session, reads the active company from a signed cookie, verifies a `CompanyMember` row joins the
   two, and returns `{ userId, companyId, role }`. No row is a 403; there is no fallback to "first
   company". `requireFirm()` builds on it, additionally resolving the active or specified firm and
   asserting that firm belongs to that company — a `firmId` from another company is a 403, not an
   empty result.
2. **A Prisma client extension** injects `companyId` into `where` on every model that carries one,
   rejects any `create` missing it, and applies `deletedAt: null`. Repositories take a `ctx` rather
   than a raw client, so forgetting the scope is a type error rather than a leak.
3. **A Vitest suite** enumerates every model in the schema and fails if a company-scoped model is
   reachable through an un-extended client path, and separately asserts that every transaction-typed
   model carries a non-null `firmId`.

Company switching sets a signed cookie and revalidates. Neither `companyId` nor `firmId` is ever read
from a URL the user can edit.

### 3.2 Why not one level

Making `Firm` the tenant, as the brief's §5 suggests, would force parties and items to be duplicated
per firm — which contradicts ref-02 and ref-03 having no firm filter — and would make the `All Firms`
option on the transaction lists meaningless, since a user would only ever be inside one firm at a
time. The two-level model is what the reference screens actually show.

---

## 4. Data model

Money is `Decimal(14,2)`, quantity `Decimal(14,3)`, rates `Decimal(6,3)`. Every business table carries
`companyId`, `createdAt`, `updatedAt`, `deletedAt`, `createdById`. Transaction-typed tables
additionally carry a non-null `firmId`.

### 4.1 Identity and tenancy

- **User** — `email` unique, `passwordHash`, `name`, `mobile`, `mobileVerified`
- **Company** *(the tenant — ref-12)* — `name`, `ownerId`, `lastActivityAt` (drives the
  `Last Sale Created` sub-line), `fyStartMonth` (default 4), `isGstEnabled`, `isCompositionScheme`,
  `isMultiFirmEnabled`, `defaultFirmId`
- **CompanyMember** — `(userId, companyId)` unique, `role` enum
  `OWNER | ADMIN | ACCOUNTANT | SALESMAN`, `invitedAt`, `acceptedAt`. A row where `userId != ownerId`
  is what populates the `Companies Shared with Me` tab
- **Firm** *(a business entity inside a company — ref-11)* — `companyId`, `name`, `gstin`,
  `stateCode`, address fields, `phone`, `email`, `logoUrl`, `signatureUrl`, `isDefault`, `isActive`.
  Unique `(companyId, lower(name))`
- **Settings** — one row per **company**, JSON columns per settings tab (`general`, `transaction`,
  `print`, `tax`, `party`, `item`, `message`), each validated by a Zod schema on read and write.
  The handful of genuinely per-firm settings (print theme, numbering prefixes) live on the firm or on
  `NumberSequence`, which is keyed by firm

### 4.2 Masters

- **Party** — `name`, `type` (`CUSTOMER | SUPPLIER | BOTH`), `gstType`, `gstin`, `stateCode`,
  `phone`, `email`, billing and shipping address, `partyGroupId`, `creditLimit`,
  `openingBalance`, `openingBalanceType` (`TO_RECEIVE | TO_PAY`), `openingAsOf`, `paymentTermDays`,
  custom fields JSON. Unique `(firmId, lower(name))`.
- **PartyGroup** — `name`
- **Item** — `name`, `type` (`PRODUCT | SERVICE`), `sku`, `hsnSac`, `unitId`, `secondaryUnitId`,
  `conversionFactor`, `salePrice`, `salePriceTaxInclusive`, `purchasePrice`,
  `purchasePriceTaxInclusive`, `wholesalePrice`, `wholesaleMinQty`, `taxRateId`, `cessRate`,
  `openingQty`, `openingRate`, `openingAsOf`, `minStockQty`, `location`, `imageUrl`, `isActive`
- **ItemCategory**, **ItemCategoryOnItem** (many-to-many), **Unit** (`name`, `shortName`)
- **TaxRate** — `name`, `rate`, `isCess`, `isExempt`, `isNilRated` — seeded 0 / 0.25 / 3 / 5 / 12 / 18 / 28

### 4.3 Transactions

One polymorphic **Transaction** table, discriminated by `type`:

```
SALE · SALE_RETURN · ESTIMATE · PROFORMA · SALE_ORDER · DELIVERY_CHALLAN · PAYMENT_IN
PURCHASE · PURCHASE_RETURN · PURCHASE_ORDER · PAYMENT_OUT
EXPENSE · STOCK_ADJUSTMENT · BANK_TRANSFER · CASH_ADJUSTMENT
```

Fields: **`firmId` (non-null)**, `number`, `numberPrefix`, `financialYear`, `date`, `dueDate`,
`partyId`, `stateOfSupply`,
`isIgst`, `subTotal`, `discountValue`, `discountIsPercent`, `discountAmount`, `additionalCharges`
JSON, `taxableValue`, `cgst`, `sgst`, `igst`, `cess`, `tcs`, `roundOff`, `total`, `paidAmount`,
`balanceAmount`, `paymentMode`, `notes`, `terms`, `status`, `convertedFromId`, `convertedToId`.

- **Unique `(firmId, type, financialYear, number)`** — the brief's duplicate rule, enforced by the DB.
  Keyed on **firm**, not company: two firms in one company legitimately both have an invoice `1`,
  because each issues invoices under its own GSTIN.
- **TransactionLine** — `itemId`, `description`, `hsnSac`, `qty`, `unitId`, `rate`,
  `rateIsTaxInclusive`, `discountValue`, `discountIsPercent`, `discountAmount`, `taxRateId`,
  `taxAmount`, `cessAmount`, `amount`, `sortOrder`, `freeQty`
- **TransactionTax** — per-transaction tax breakup rows (rate, taxable, cgst, sgst, igst, cess),
  the source of the HSN summary and the GST reports
- **PaymentAllocation** — `paymentTransactionId`, `invoiceTransactionId`, `amount`

### 4.4 Derived ledgers — the heart of principle 2

Balances are **never** stored on the master as an editable counter.

- **StockMovement** — `itemId`, `transactionId`, `date`, `qtyIn`, `qtyOut`, `rate`, `reason`.
  Stock on hand = `SUM(qtyIn) − SUM(qtyOut)`. Opening stock and every `ADJUSTMENT` are rows here too.
- **LedgerEntry** — `accountType` (`PARTY | CASH | BANK | EXPENSE | TAX | ROUND_OFF | CAPITAL`),
  `accountId`, `transactionId`, `date`, `debit`, `credit`, `narration`. Party balance, cash in hand
  and every bank balance are sums over this table.
- **BalanceCache** — optional per-entity materialised totals for list-screen speed, rebuilt by
  `Verify My Data`. A cache miss or a drift is a performance bug, never a correctness one.

### 4.5 Supporting

- **BankAccount** — `displayName`, `accountNumber`, `ifsc`, `upiId`, `openingBalance`, `openingAsOf`
- **Cheque** — `transactionId`, `partyId`, `chequeNumber`, `amount`, `dueDate`,
  `status` (`OPEN | DEPOSITED | WITHDRAWN | BOUNCED`), `closedOn`
- **LoanAccount** and **LoanTransaction**
- **ExpenseCategory** — `name`, `expenseType` (`DIRECT | INDIRECT`) *(per ref-07)*
- **NumberSequence** — `(firmId, type, financialYear)` unique, `prefix`, `nextNumber`, `resetYearly`
  — per firm, matching the constraint above
- **Attachment** — `transactionId`, `fileName`, `mimeType`, `size`, `storageKey`
- **AuditLog** — `companyId`, `firmId` (nullable — master edits are company-level), `userId`,
  `entity`, `entityId`, `action`, `before` JSON, `after` JSON, `at`

### 4.6 Indexes

Composites on `(companyId, deletedAt)`, `(companyId, firmId, type, date)`,
`(companyId, partyId, date)`, `(companyId, itemId, date)`,
`(firmId, type, financialYear, number)` unique, plus a trigram index on `Party.name` and `Item.name`
for the pickers. The `All Firms` filter is served by leaving `firmId` out of the predicate, so the
leading `companyId` keeps that path indexed too.

---

## 5. The calculation engine — `lib/calc`

**Pure, synchronous, no I/O, no Prisma imports.** Input is a plain object, output is a plain object.
This is the only place currency maths happens, and it is the most heavily tested module in the repo.

```ts
computeTransaction(input: TxnCalcInput): TxnCalcResult
```

Fixed order of operations, matching the brief:

1. Per line: if the rate is tax-inclusive, strip tax to get the exclusive rate
   (`exclusive = inclusive × 100 / (100 + rate + cess)`)
2. Line gross = `qty × exclusiveRate`
3. Line discount (percent or amount) -> line taxable
4. Bill-level discount, apportioned across lines **pro rata by line taxable value**, so each line's
   tax base falls correctly. The apportionment remainder in the last paisa goes to the largest line.
5. Additional charges added, taxable ones joining the tax base at their own rate
6. Tax per line: `partyStateCode === firmStateCode` -> CGST + SGST, each `rate / 2`; otherwise IGST at
   the full rate. Cess is computed on the same base.
7. TCS, if enabled, on `taxableValue + tax`
8. Round-off to the nearest rupee if enabled, emitted as its own signed line
9. Grand total

Rounding: every intermediate stays at full `decimal.js` precision; only the persisted fields round,
half-up, to 2 dp. A `sum(lines) === header` invariant is asserted at the end of every computation and
throws in development.

Also in `lib/calc` (or its siblings): `amountInWords()` in the Indian system,
`indianDigitGroup()`, `hsnSummary()`, and `splitPlaceOfSupply()`.

Vitest coverage is the phase-3 gate: the cross-product of inclusive/exclusive x
line discount percent/amount x bill discount percent/amount x intra/inter-state x
every rate including 0 and 0.25 x cess on/off x TCS on/off x round-off on/off, plus
regression fixtures taken from the observed invoices in ref-04.

---

## 6. Critical flows

### 6.1 Saving a sale invoice

One `prisma.$transaction`, serializable:

1. `requireFirm()` — resolves company + firm, asserts membership, permission check
2. Zod-parse the payload
3. Re-run `computeTransaction` **server-side** and ignore the client's totals entirely
4. Allocate the number from `NumberSequence` with a `SELECT … FOR UPDATE`, unless the user typed one;
   a collision surfaces as a field error, not a 500
5. Insert `Transaction`, `TransactionLine[]`, `TransactionTax[]`
6. Insert `StockMovement` rows (`qtyOut` for each product line; services and estimates emit none)
7. Insert `LedgerEntry` rows: debit Party, credit Sales, credit each tax account, credit round-off
8. If money was received, insert the Payment-In and its `PaymentAllocation`
9. Write the `AuditLog` row
10. Commit, then `revalidatePath` the affected lists

Editing re-runs the same pipeline: the prior movements, entries and allocations are deleted inside the
same transaction and rewritten. Deleting sets `deletedAt` and reverses the postings — history stays
readable from the Recycle Bin.

### 6.2 Numbering

`NumberSequence` is keyed `(firmId, type, financialYear)` — **per firm**, so each firm in a
multi-firm company runs its own series. `resetYearly` decides whether a new FY starts at 1 or
continues. Prefixes are per type and may be **empty** — ref-04 shows bare integers `428`–`434`, so an
empty prefix must round-trip. Manual numbers are allowed and validated against the unique constraint.

### 6.3 Place of supply

`firm.stateCode` vs `party.stateCode` — the **firm's** state, since the firm holds the GSTIN and is
the legal supplier. In a multi-firm company the same party can be intra-state for one firm and
inter-state for another, and the tax split must follow the firm. The party's code is derived from its
GSTIN when
registered, from the chosen state otherwise. Equal -> CGST + SGST; different -> IGST. Unregistered and
consumer parties default to the firm's state, overridable per transaction, exactly as briefed.

### 6.4 Reports

Read-only services under `server/services/reports/`. Each exposes `query(filters) -> rows + totals`,
consumed by the page, the Excel route and the PDF route so the three can never disagree. Everything
is server-paginated; aggregates are SQL, not JS loops.

Every report takes an optional `firmId`; omitting it is the `All Firms` case. The **GST reports are
the exception — they require a single firm**, because GSTR-1/2/3B are filed per GSTIN. Those screens
force a firm selection rather than offering "All Firms".

### 6.5 Financial-year close

Computes closing party, cash, bank and stock balances as of 31 March, writes them as opening rows in
the new FY, and marks the old FY read-only unless explicitly reopened.

---

## 7. Security

- Every server action: `requireCompany()` / `requireFirm()` -> permission check -> Zod parse -> act.
  No exceptions. A `firmId` belonging to another company is a 403, never an empty result set.
- All totals recomputed server-side; client numbers are display only.
- `deletedAt` filtering lives in the Prisma extension, not in hand-written `where` clauses.
- Attachments are validated by magic bytes, not by extension, and served through an authorised route.
- Rate limiting on auth routes; passwords bcrypt cost 12.
- The audit log is append-only and mirrors the `Audit Trail` switch in ref-11.

---

## 8. Design system (original branding)

Our own palette, chosen to be legible against the reference layout without borrowing its colours:

| Token | Role |
|---|---|
| `--brand` deep teal | Primary actions, active nav |
| `--accent` warm amber | Secondary emphasis, the split-button treatment seen in ref-03 |
| `--surface` / `--surface-2` | Page and card backgrounds |
| `--positive` green / `--negative` rose | Receivable vs payable, positive vs negative stock |

Typography: Inter for UI, tabular figures for every money column. Dark mode is defined from the first
phase because retrofitting tokens later is expensive. Icons are lucide-react only. The logo is an
original wordmark placeholder in `components/brand/`.

---

## 9. Testing

| Layer | Tool | What |
|---|---|---|
| Calculation | Vitest | The `lib/calc` matrix in §5 — the gate on phase 3 |
| GST | Vitest | GSTIN validation, state extraction, place of supply, GSTR-1 JSON shape |
| Numbering | Vitest | FY reset, empty prefix, manual override, duplicate rejection |
| Posting | Vitest + a test DB | Stock and ledger are balanced after create / edit / delete |
| Tenancy | Vitest | Every company-scoped model is unreachable without a `companyId`; every transaction model has a non-null `firmId`; a `firmId` from another company 403s |
| Multi-firm | Vitest | Two firms in one company keep independent number series; masters stay shared; place of supply follows the firm |
| Flows | Playwright | Sign up -> create company -> onboard firm -> add party -> add item -> raise invoice -> take payment -> print PDF -> check the report; plus create a second company and prove its data is invisible from the first |

## 10. Definition of done, per phase

Zero TypeScript errors, zero ESLint errors, all tests green, loading / empty / error states present on
every new screen, no TODOs and no mock data, `DECISIONS.md` updated, and a written list of any
deviation from the references.

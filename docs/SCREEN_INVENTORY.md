# Screen Inventory

Working app name: **Bella Books** (placeholder — see `DECISIONS.md` D-01; one rename away from final).

Derived from the twelve reference screenshots, plus the feature brief. This document is the contract
for *what screens exist and what is on them*. `ARCHITECTURE.md` covers how they are built.

> Eleven screenshots are archived in `references/`. **ref-12 (Company List) is transcribed in §2.5
> but the PNG was never written to disk** — see `references/README.md`.

## Legend

| Tag | Meaning |
|---|---|
| **[O]** | **Observed** — visible in a screenshot, described as seen |
| **[I]** | **Inferred** — the nav item or tab exists in a screenshot but its screen was not captured; contents deduced from context and the brief |
| **[B]** | **Brief-only** — required by the project brief, no reference image |
| **[A]** | **Assumption** — a judgement call I made; every one is repeated in §14 for your sign-off |

All screenshots are 1917x1079 (desktop-first). Mobile and tablet layouts are **[A]** throughout —
no responsive reference exists.

---

## 1. Global application shell **[O — all refs]**

### 1.1 Title bar (desktop app chrome) **[O ref-01]**

Menu strip: `Company`, `Help`, `Versions`, `Shortcuts`, a refresh icon. Centre: "Customer Support :"
with two phone numbers and a `Get Instant Online Support` link. Right: minimise / maximise / close.

> **[A]** This is OS window chrome for an Electron app. On the web we drop the window buttons and
> keep a slim utility strip: firm menu, Help, What's New (replaces "Versions"), Keyboard Shortcuts,
> Refresh, Support. No phone numbers.

### 1.2 Left sidebar **[O ref-01..ref-11]**

- Fixed ~293px wide, dark navy, full height, independently scrollable.
- Top: **"Open Anything (Ctrl+F)"** — a global command palette input.
- Nav tree of single items and expandable groups with a chevron. Expanding a group pushes the items
  below it down (in-place accordion, **not** a flyout) — except **Reports**, which opens a **flyout
  panel** over the content area with its own collapse chevron **[O ref-08]**.
- Active item: accent left border plus a lighter background **[O ref-02, ref-04]**.
- Sub-items under Sale / Purchase / Parties / Items carry a trailing **`+` quick-add** button
  **[O ref-04, ref-05]**.
- Premium-only items carry a crown badge; `Whatsapp Connect` also carries a **NEW** pill **[O ref-02]**.
- The sidebar collapses via a chevron at its right edge **[O ref-08]**.
- Bottom, pinned: an upsell card ("351 users got Vyapar Premium in last 24hrs!"), a premium CTA,
  and a **company switcher** row showing the active company with its avatar and a `>` chevron
  (`BELLA EVENT'S` in ref-01). **[A]** This opens the Company List of §2.5. Switching *firm* within a
  company is a different control — the `All Firms` filter on transaction lists plus the firm card in
  Settings (§2.6).

> **[A]** We keep the command palette, the tree, the quick-add `+`s, collapse, and the company
> switcher. We drop the upsell card, the premium CTA and every crown badge. All features ship
> unlocked; where the brief defers something to a later phase, the nav item is hidden rather than
> teased.

#### Full navigation tree **[O]**

```
Home
Parties          -> Party Details [+] · Loyalty Points* · Whatsapp Connect* (NEW) · Vyapar Network*
Items            -> Item Details [+] · Godown Management*
Sale             -> Sale Invoices [+] · Estimate/Quotation [+] · Proforma Invoice [+] · Payment-In [+]
                    · Sale Order [+] · Delivery Challan [+] · Sale Return/Credit Note [+] · POS*
Purchase &       -> Purchase Bills [+] · Payment-Out [+] · Expenses [+] · Purchase Order [+]
  Expense           · Purchase Return/Dr. Note [+]
Grow Your        -> Google Profile Manager* · Marketing Tools* · WhatsApp Marketing*
  Business          · Online Store* · Smart Ads*
Cash & Bank      -> (collapsed in every ref) [I]
Reports          -> (flyout, see §9)
Sync, Share &    -> (collapsed in every ref) [I]
  Backup
Utilities        -> Import Items · Set Up My Business · Accountant Access · Barcode Generator*
                    · Update Items In Bulk* · Import From Tally* · Import Parties
                    · Track Your Salesmen* · Exports To Tally* · Export Items · Verify My Data
                    · Recycle Bin*
Settings
Plans & Pricing
```

`*` = premium-gated in the reference app.

**Scope calls [A]:** `Loyalty Points`, `Vyapar Network`, `Godown Management`, `POS`, the whole
`Grow Your Business` group, Tally import/export, `Barcode Generator` and `Track Your Salesmen` are
**out of scope** — none appear in the brief. `Cash & Bank`, `Sync, Share & Backup`, `Recycle Bin`
(= soft-delete restore) and `Accountant Access` (= users and roles) **are** in the brief and stay.
`Plans & Pricing` is out of scope until a billing phase is commissioned.

### 1.3 Top action bar **[O ref-01..ref-03, ref-07]**

Left: a `Search Transactions` input with a magnifier. Right: **`+ Add Sale`** (filled red),
**`+ Add Purchase`** (tinted blue), a circular **`+`**, a **print** icon, a **kebab** menu.

> **[A]** The circular `+` opens a menu of every remaining creatable record: Payment-In,
> Payment-Out, Expense, Estimate, Sale Order, Purchase Order, Delivery Challan, Credit Note,
> Debit Note, Party, Item. The kebab holds Import / Export, Settings and Help.

### 1.4 Banners **[O ref-01]**

Two stacked dismissable banners above the dashboard: an amber "message limits are changing …
`View Details >`" notice, and a red "Your Free Plan has expired" bar with `Buy Now` and
`Get Free Demo` buttons.

> **[A]** Replaced by one generic `SystemBanner` component (info / warning / error, optional CTA,
> dismissal persisted per user). No billing content in the phases this brief covers.

### 1.5 Recurring layout patterns **[O]**

| Pattern | Seen in | Description |
|---|---|---|
| **Master–detail** | ref-02, ref-03, ref-07 | Scrollable searchable list on the left (~390px), detail pane on the right, first row auto-selected |
| **List + filter bar + summary** | ref-04, ref-05, ref-06 | Filter row, then KPI card(s), then the transactions table |
| **Tabbed master–detail** | ref-03, ref-07 | Full-width tab strip above the split |
| **Table toolbar** | ref-02, ref-03, ref-04, ref-07 | Right-aligned icon cluster: search, chart, Excel (green `xls`), print |
| **Per-column filter** | ref-02..ref-05, ref-07 | A funnel icon in every column header |
| **Row kebab** | ref-02, ref-03, ref-04, ref-07 | Trailing vertical-dots menu per row: View / Edit / Duplicate / Delete / Print / Share |
| **Empty state** | ref-05, ref-06, ref-07 | Centred illustration, headline, sub-line, primary CTA — e.g. "No Transactions to show / You haven't added any transactions yet." |
| **Title dropdown** | ref-02, ref-04, ref-06 | The page title is itself a `v` dropdown that jumps to a sibling screen |

### 1.6 Keyboard **[O + B]**

`Ctrl+F` opens the command palette **[O]**; a `Shortcuts` menu exists in the title bar **[O ref-01]**.
The brief requires Tab/Enter movement across invoice line-item cells, a shortcut to add a row, and
`Ctrl+S` to save. **[A]** Full map: `Alt+S` Add Sale, `Alt+P` Add Purchase, `Alt+N` new line row,
`Ctrl+S` save, `Ctrl+Shift+S` save and new, `Esc` close modal, `?` shortcut cheatsheet.

---

## 2. Auth and onboarding **[B]**

No reference images; every screen below comes from the brief.

| Screen | Route | Fields and behaviour |
|---|---|---|
| Sign up | `/signup` | Name, email, mobile, password, confirm. Zod-validated, bcrypt hash. Creates `User`, redirects to onboarding |
| Log in | `/login` | Email + password, "Remember me", forgot-password link |
| Forgot password | `/forgot-password` | Email, token mailed (logged to console in dev) |
| Reset password | `/reset-password/[token]` | New password + confirm, 1 hour token expiry |
| **Company List** | `/companies` | The post-login gate — §2.5 **[O ref-12]** |
| Company onboarding wizard | `/onboarding` | Multi-step, modelled on ref-10 (§10.2) |
| Create company | `/companies/new` | Runs the onboarding wizard for an additional company |
| Switch company | shell footer + `/companies` | Sets the active company; see §2.6 |
| Manage firms within a company | `/settings/firms` | Multi Firm, per ref-11 §12.1 |

**[A]** Mobile-OTP login is deferred (the brief says "optional … later"). The schema keeps `mobile`
and `mobileVerified` columns so it can be added without migrating existing rows. Note that ref-12
shows the reference app authenticating **by phone number** ("Currently logged in with Phone:
9946050006"), not by email — we stay on email+password per the brief and treat phone as secondary.

---

### 2.5 Company List — `/companies` **[O ref-12]**

The screen shown after login and before the app shell. A centred panel over a tiled watermark
background.

**Panel header (dark):** `Company List` on the left, a rounded **`Search Company`** input on the
right. Below, two tabs: **`Companies Shared with Me`** and **`My Companies`** (active, underlined).

**Sub-header (light):** the caption `Below are the company that are created by you`, and on the right
a **`Browse Files (.vyp)`** link plus a circular **refresh** button.

**Company rows** — white cards in a scrollable list. Each row carries:

| Element | Detail |
|---|---|
| Company name | Bold. May be a bare numeric id (`99460500061725863874877`), a default name (`My Company`), or a filename (`A ONE EVENT.vyp`, `Crystal Events.vyp`) |
| Current marker | An amber dot plus the label `Current Company`, on one row only |
| Sub-line | `Last Sale Created: 21/09/2026 at 10:45 am` — so each company tracks its own last-activity timestamp |
| Sync state | A monitor icon plus `SYNC ON`, or a struck-through monitor plus `SYNC OFF` |
| `Open` | Outlined blue button — switches to that company |
| Kebab | Per-row menu **[A]** — Rename, Share, Backup, Delete, Sync on/off |

Observed rows: `99460500061725863874877` (Current Company, SYNC ON, last sale 21/09/2026 10:45 am);
`My Company` (SYNC OFF, 03/09/2026 09:03 pm); `A ONE EVENT.vyp` (SYNC ON, 24/08/2026 01:38 pm);
`Crystal Events.vyp` (SYNC ON, 21/09/2026 — *sic*, listed as 21/09/2026 in the capture).

**Footer bar:** `Currently logged in with Phone:` above `9946050006` on the left;
**`Restore backup`** (outlined) and **`New Company`** (filled blue) on the right.

**Below the panel:** a `Logout` link with the caption `Logging out will stop syncing data`.

**Scope [A]:** `Browse Files (.vyp)`, the `SYNC ON / SYNC OFF` indicator and the refresh button are
desktop-file-sync concepts — a company there is a local `.vyp` file that syncs to the cloud. On the
web every company is server-side and always current, so all three are dropped. `Restore backup`,
`New Company`, `Logout`, search, the two tabs and the last-activity sub-line all stay.

**`Companies Shared with Me` [O tab] [A]:** companies owned by another user where you have been
granted a role. This is the same mechanism as `Accountant Access` in Utilities (§10.3) and the brief's
users-and-roles requirement — one feature, two entry points. The tab ships in the users-and-roles
phase; until then it renders its empty state.

---

### 2.6 Company vs Firm — a two-level model **[O ref-12 + ref-11 + ref-04/ref-05]**

This is the most consequential thing the references establish, and it **contradicts the brief's data
model**, so it is set out in full.

The brief says: *"Multi-tenant by firm. Every business record belongs to a `Firm` (company)."* —
treating the two words as synonyms. The reference app has **two distinct levels**:

| | **Company** | **Firm** |
|---|---|---|
| What it is | A whole isolated data set | A business entity *inside* one company |
| Evidence | ref-12: you `Open` one at a time; each has its own last-sale date | ref-11: a `Multi Firm` toggle with a firm card list; ref-04/ref-05: an `All Firms` filter |
| Owns | Parties, items, units, categories, transactions, settings | Its own name, GSTIN, address, logo, signature, invoice numbering |
| Switching | Log out of one data set and into another (§2.5) | A filter and a per-transaction field, inside one data set |

**The decisive evidence:** the `All Firms` / `ALL FIRMS` filter appears on the **transaction** lists
(ref-04 Sale Invoices, ref-05 Purchase Bills) and **nowhere on the master lists** — ref-02 Parties and
ref-03 Items have no firm filter at all. That means **parties and items are shared across the firms of
one company, while transactions are tagged to a specific firm.** A single-level model cannot express
that.

**Consequence for the data model:** `Company` becomes the tenant, `Firm` becomes a child of it, and
transactions carry both. `ARCHITECTURE.md` §3–§4 is written against this, and `DECISIONS.md` D-20
records the deviation from the brief.

---

## 3. Home / Dashboard — `/dashboard` **[O ref-01]**

A main column (~2/3) with a right rail (~1/3), then a full-width strip below.

### 3.1 KPI cards **[O]**

Two side-by-side cards:

- **Total Receivable** — `Rs 1,38,12,793`, sub-line `From 122 Parties`, green circular down-arrow badge.
- **Total Payable** — `Rs 89,555`, sub-line `From 3 Parties`, pink circular up-arrow badge.

Note the Indian digit grouping (`1,38,12,793`) and that the dashboard shows whole rupees with no
decimals, while list screens show 2 dp (`Rs 13,21,350.08` in ref-04). **[A]** The dashboard rounds
for readability; every detail screen shows full precision.

**[A]** Both cards are clickable, linking to the All Parties report filtered to receivable / payable.

### 3.2 Total Sale card **[O]**

Header `Total Sale`, amount `Rs 13,21,350`, delta `390% more than last month` in green, and a period
dropdown top-right reading **`This Month`**. Body: a smooth area chart, Y axis
`0 / 200k / 400k / 600k / 800k`, X axis daily ticks labelled every three days `1 Sep … 28 Sep`,
with two sharp spikes.

**[A]** Period options: Today, This Week, This Month, Last Month, This Quarter, This FY, Last FY,
Custom. The delta is `(current − previous) / previous`; when the previous period is zero we show
`—` rather than an infinite percentage.

### 3.3 Right rail widgets **[O]**

Two upsell cards (WhatsApp Connect and Google Profile Manager, both stamped `TRIAL EXPIRED` with a
`Buy Now >` link), then a dashed **`Add Widget of Your Choice  +`** slot.

**[A]** We keep the *mechanism* — a user-configurable widget rail persisted per user and firm — and
drop the upsells. Widget catalogue: Cash & Bank balance, Low-stock alerts, Overdue invoices, Top
parties by receivable, Top-selling items, Expense split, Recent transactions, Stock value. The
brief's "cash & bank balance", "low-stock alerts" and "recent transactions" become the defaults.

### 3.4 Most Used Reports strip **[O]**

Full-width panel headed `Most Used Reports` with a `View All` link, then four cards each showing a
report name and a `>` chevron: `Sale Report`, `All Transactions`, `Daybook Report`, `Party Statement`.

**[A]** "Most used" is real usage data — a per-user report-open counter — falling back to those four
for a new user.

### 3.5 Quick actions **[B]**

The brief asks for Add Sale / Add Purchase / Payment In / Payment Out / Add Party / Add Item buttons.
In ref-01 these live in the global top bar (§1.3), not on the dashboard body. **[A]** We satisfy the
brief through the top bar plus the circular `+` menu and do not duplicate them as a dashboard tile row.

---

## 4. Parties

### 4.1 Party list and detail — `/parties` **[O ref-02]**

**Header:** title `Parties v` (dropdown); right: **`+ Add Party`** (filled red), a **gear**
(column settings), a **kebab**.

**Left list panel**

- `Search Party Name` input with a magnifier.
- Column headers `Party Name` (funnel) and `Amount` (right-aligned).
- Rows show the name on the left and the balance on the right. Balances render green in the capture,
  including `0.00`; payables render red **[A — no payable row is visible in ref-02; inferred from the
  Total Payable colour in ref-01]**.
- The selected row has a tinted background; rows are subtly striped.
- Visible data confirms the shape: `Thrissur district Sport's council 2,050.00`,
  `secretary DTPC Thrissur 7,33,500.00`, `Dr. Niji Justin 11,540.00`, many at `0.00`.
  Party names are free-form, mixed-case and long, and they truncate with an ellipsis.
- A pinned promo strip sits at the bottom of the list: "Use contacts from your Phone or Gmail to
  quickly create parties." **[A]** Replaced by an **`Import parties from Excel`** strip.

**Right detail panel**

- Party name as a heading with an **edit pencil**.
- Top-right icon cluster: **message bubble** (SMS), **WhatsApp** (green), and a third circular icon
  **[A — read as payment reminder / history; implemented as a Reminder action]**.
- A `Transactions` section with a toolbar of **search**, **print** and **Excel** icons.
- Table columns, each with a funnel: `Type` | `Number` | `Date` | `Total` | `Balance` | kebab.
  Example row: `Sale | 432 | 19/09/2026 | Rs 2,050.00 | Rs 2,050.00`.
  Dates are `DD/MM/YYYY`; money is prefixed `Rs` with 2 dp inside tables.

**[B] additions to the detail pane:** a current-balance headline, a credit-limit indicator, and a
**Party Statement / ledger** view with a date filter and share/print. The brief requires these and
they are not visible in ref-02.

### 4.2 Add / Edit Party **[I]** — modal opened by `+ Add Party`

**[A]** A tabbed dialog:

| Tab | Fields |
|---|---|
| **General** | Party Name*, Phone, Email, **GST Type** (Unregistered / Registered / Composition / Consumer / Overseas / SEZ), GSTIN (validated, state auto-derived), **State**, Billing Address, Shipping Address with a "same as billing" toggle, Party Group, Party Type (Customer / Supplier / Both) |
| **Credit & Balance** | **Opening Balance** amount, **To Receive / To Pay** radio, **as-of date**, **Credit Limit** (none or custom), payment terms in days |
| **Additional** | Up to four user-defined fields, date fields, notes |

Validation **[B]**: GSTIN regex `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$`; the
leading two digits are the state code and must agree with the chosen state; phone 10 digits; name
unique per firm, case-insensitive.

### 4.3 Party groups **[B]** — `/parties/groups`

A CRUD list. Groups are consumed by the *Sale Purchase By Party Group* report (ref-08).

### 4.4 Import Parties **[O ref-09 sidebar]** — `/utilities/import-parties`

Same Excel flow as items; see §10.1.

---

## 5. Items

### 5.1 Items screen — `/items` **[O ref-03]**

**Tab strip, full width:** `PRODUCTS` | `SERVICES` | `CATEGORY` | `UNITS`, active tab underlined.

**Left list panel (PRODUCTS)**

- A magnifier icon that expands into a search field.
- **`+ Add Item`** rendered as an orange **split button** — label plus a separate caret **[A]** (Add
  Product / Add Service / Import from Excel) — with a kebab beside it.
- A **`Godown: All Godowns`** dropdown. Godowns are out of scope (§1.2); the control is hidden when
  multi-godown is off.
- Column headers `ITEM` (funnel) and `QUANTITY`; every row ends in a kebab.
- Quantities can be **negative and render red** (`-150`, `-20`, `-130`, `-3`); zeros render grey.
  This confirms negative stock is allowed by default and matches `Stop Sale on Negative Stock` being
  **unchecked** in ref-11.
- Real names are long and free-form (`(Chicken/ Fish)`, `04.01.2025 Lunch`,
  `10 ft W * 50 - 100 mtrs of…`), so the list truncates and the detail pane must show the full name.

**Right detail panel**

- Item name with a **share** icon; **`ADJUST ITEM`** button (filled blue) top-right.
- Two metric columns:
  - `SALE PRICE: Rs 2,500.00 (incl)` and `PURCHASE PRICE: Rs 0.00 (excl)` — the tax-inclusive flag is
    **per price field** and surfaced in the UI as `(incl)` / `(excl)`.
  - `STOCK QUANTITY: 0` with a red warning triangle, and `STOCK VALUE: Rs 0.00`.
- A `TRANSACTIONS` table with a search box and an Excel icon. Columns: status **dot** (green) |
  `TYPE` | `INVOICE/REF NO.` | `NAME` | `DATE` (sorted descending, arrow shown) | `QUANTITY` |
  `PRICE/ UNIT` | `STATUS` | kebab. Type values include the godown: `Estimate (Main Godown)`.

### 5.2 Add / Edit Item **[I]**

**[A]** A tabbed dialog:

| Tab | Fields |
|---|---|
| **Basic** | Item Name*, Item Code / SKU with a generate action, **HSN/SAC** with lookup, Category (multi), primary Unit plus secondary unit and conversion factor, image, description |
| **Pricing** | Sale Price with incl/excl toggle and optional discount, Purchase Price with incl/excl toggle, Wholesale Price with a minimum wholesale quantity, **Tax Rate** (0 / 0.25 / 3 / 5 / 12 / 18 / 28 / exempt / nil-rated) plus cess |
| **Stock** | Opening Quantity, At Price, As-of Date, **Min Stock to maintain** (drives the low-stock alert), Item Location |
| **Additional** | Up to three custom fields, "item is taxable" toggle, active / inactive |

Services hide every stock field.

### 5.3 Adjust Item **[O ref-03 button] [B]**

**[A]** Dialog with an Add / Reduce radio, quantity, adjustment date, price per unit for valuation,
and a reason. It writes a `StockMovement` of type `ADJUSTMENT` and never edits a stored counter.

### 5.4 Categories tab **[O ref-03]** — list plus item assignment.

### 5.5 Units tab **[O ref-03]** — unit master (name, short name) plus conversion pairs.

### 5.6 Import / Export Items **[O ref-09, ref-10 sidebar]** — see §10.1.

---

## 6. Sales

### 6.1 Sale Invoices list — `/sale/invoices` **[O ref-04]**

**Sidebar group (expanded):** `Sale Invoices`, `Estimate/ Quotation`, `Proforma Invoice`,
`Payment-In`, `Sale Order`, `Delivery Challan`, `Sale Return/ Credit Note`, `Vyapar POS*` — each
with a `+` quick-add.

**Header:** `Sale Invoices v` (title dropdown), **`+ Add Sale`** (filled red), a gear.

**Filter bar** — the canonical transaction-list filter, reused on every list screen:
`Filter by :` then a **period dropdown** (`This Month`), a **date range** (`01/09/2026 To 30/09/2026`)
with a calendar icon, **`All Firms`**, **`All Users`**, **`All Godown`**. Rendered as rounded pills.

**Summary card:** `Total Sales Amount` `Rs 13,21,350.08`, a green `390.18% ↗ vs last month` chip, and
a split line `Received: Rs 1,50,000 | Balance: Rs 11,71,350.08`.

**Transactions table** — toolbar of search, **bar-chart**, **Excel**, **print** icons. Columns each
with a funnel: `Date` | `Invoice no` | `Party Name` | `Transaction` | `Payment Type` | `Amount` |
`Balance` | `Actions`. The Actions cell holds a **print** icon, a **share** icon and a **kebab**.

Observed rows (useful as seed data):

| Date | Invoice no | Party | Txn | Payment | Amount | Balance |
|---|---|---|---|---|---|---|
| 21/09/2026 | 434 | Banerji Memorial Club | Sale | Cash | Rs 3,62,797 | Rs 2,12,797 |
| 21/09/2026 | 433 | SECRETARY REGENCY CLUB THRIS… | Sale | Cash | Rs 2,06,743.08 | Rs 2,06,743.08 |
| 19/09/2026 | 432 | Thrissur district Sport's council | Sale | Cash | Rs 2,050 | Rs 2,050 |
| 12/09/2026 | 431 | secretary DTPC Thrissur | Sale | Cash | Rs 3,58,500 | Rs 3,58,500 |
| 12/09/2026 | 430 | secretary DTPC Thrissur | Sale | Cash | Rs 3,75,000 | Rs 3,75,000 |
| 04/09/2026 | 429 | VAIDYARATNAM OUSHADHASALA | Sale | Cash | Rs 4,661 | Rs 4,661 |
| 03/09/2026 | 428 | Manorama. | Sale | Cash | Rs 11,599 | Rs 11,599 |

Notes: invoice numbers are **plain integers with no prefix** in this firm — so a blank prefix must be
valid. `Balance` below `Amount` on row 434 proves partial payment is recorded on the invoice itself.

### 6.2 Sale Invoice form — `/sale/invoices/new` **[B + I]**

Not captured. The brief specifies it in detail; **[A]** the layout follows the Vyapar convention and
the invoice preview in ref-10, which tells us exactly which fields must reach the printed document.

**Header row:** transaction-type toggle (Credit / Cash), Invoice Number (editable, pre-filled from
the sequence), Invoice Date, Due Date / payment terms, a state-of-supply selector.

**Party block:** a searchable party picker with an inline **"+ Add New Party"** row, then the selected
party's phone, GSTIN, billing address and current balance.

**Line-item grid** — columns `#`, Item name (searchable picker with inline **"+ Add New Item"**),
HSN/SAC, Qty, Unit, Price/Unit with an incl/excl marker, Discount (% and amount), Tax (rate and
amount), Amount, and a delete action. Tab and Enter walk the grid, `Alt+N` adds a row, and the last
row auto-extends.

**Totals panel:** subtotal, bill-level discount (% or amount), additional charges (shipping,
packaging, each optionally taxable), taxable value, CGST/SGST or IGST, cess, TCS, round-off, and the
grand total, followed by **Received amount** plus a payment-mode picker (Cash / Cheque / Bank / UPI,
multi-mode split) and the resulting **Balance Due**.

**Footer:** description / notes, terms and conditions, an attachment upload, and
`Save`, `Save & New`, `Save & Print` buttons.

### 6.3 Other sale documents **[O sidebar ref-04]**

| Screen | Route | Notes |
|---|---|---|
| Estimate / Quotation | `/sale/estimates` | Same form; no stock or ledger posting. Confirmed live in the data — ref-03 shows two `Estimate (Main Godown)` transactions against an item, so estimates **do** appear in item history |
| Proforma Invoice | `/sale/proforma` | Same form; no posting |
| Sale Order | `/sale/orders` | Adds an advance-received field and an order status (Open / Partial / Closed) |
| Delivery Challan | `/sale/challans` | Moves stock, posts no ledger entry; the `Print amount in Delivery Challan` setting in ref-11 controls whether prices print |
| Payment-In | `/sale/payments-in` | Receipt against one or more invoices; §6.4 |
| Sale Return / Credit Note | `/sale/credit-notes` | Reverses stock and ledger; can be raised against an invoice or standalone |

**Conversions [B]:** Estimate -> Sale Order -> Invoice, and Delivery Challan -> Invoice. **[A]** A
`Convert to…` entry in the row kebab opens the target form pre-filled, and the source is stamped with
`convertedToId` so it cannot be converted twice.

### 6.4 Payment-In / Payment-Out form **[O ref-06 for the list] [B for the form]**

**[A]** Fields: Receipt No (own sequence), Date, Party, Payment Mode, Amount Received, an
**invoice allocation table** (invoice no, date, total, due, this-payment) with an auto-allocate
oldest-first action, plus Notes and an attachment. Any unallocated remainder becomes on-account
credit for the party.

---

## 7. Purchases and expenses

### 7.1 Purchase Bills list — `/purchase/bills` **[O ref-05]**

**Header:** `Purchase Bills`, an outlined **`Upload Purchase Bills`** split button with a caret, and
**`+ Add Purchase`** (filled red).

**Filter bar** — a slightly different treatment from ref-04: a `This Month` dropdown, a **`Between`**
label, two date inputs, `ALL FIRMS`, `All Godown`, `ALL USERS`, then right-aligned
**`Excel Report`** and **`Print`** buttons with icons and labels.

> **[A]** Two filter-bar treatments exist across the reference screens (pill-style in ref-04/ref-06,
> boxed in ref-05). We standardise on the ref-04 pill treatment everywhere and note the deviation.

**Summary:** three coloured chips forming an equation — green `Paid Rs 0.00` **+** blue
`Unpaid Rs 0.00` **=** amber `Total Rs 0.00`.

**Table:** `DATE` | `INVOICE NO.` | `PARTY NAME` | `PAYMENT TYPE` | `AMOUNT` | `BALANCE DUE`, with a
search box above and the empty state `No transactions to show`.

**[A]** `Upload Purchase Bills` is OCR bill scanning — **out of scope**. The button is not built.

### 7.2 Payment-Out list — `/purchase/payments-out` **[O ref-06]**

Header `Payment-Out v` with **`+ Add Payment-Out`** and a gear. Filter bar: `This Month`, date range,
`All Firms`, `All Users`. Summary card: `Total Amount Rs 0`, a `0% ↗ vs last month` chip, and
`Paid: Rs 0`. Body: the canonical **empty state** — illustration, `No Transactions to show`,
`You haven't added any transactions yet.`, and a primary `+ Add Payment-Out` button.

### 7.3 Expenses — `/expenses` **[O ref-07]**

**Tabs:** `CATEGORY` | `ITEMS`.

**Left panel (CATEGORY):** search icon, **`+ Add Expense`** (filled red), column headers
`CATEGORY` (with an ascending sort arrow) and `AMOUNT`, each row with a kebab. Observed categories
show this is free-form, user-created data: `edwin photo grafer 0`, `EVENT EXPENSE 0`,
`gopika welcom girl 1500`, `murugan v pandal 17000`, `Petrol 500`, `Rent 5000`, `Salary 0`,
`stage abi (co) sanu 17000`, `Tea 0`, `Transport 0`.

**Right panel:** the category name as a heading, a sub-label **`Direct Expense`** — so a category
carries an **expense type** (Direct / Indirect) — and a right-aligned `Total : Rs 0.00` /
`Balance : Rs 0.00` pair. Below: a search box and a table
`DATE` | `EXP NO.` | `PARTY` | `PAYMENT TYPE` | `AMOUNT` | `BALANCE`, with the `No transactions to
show` empty state.

**ITEMS tab [I]:** expense *items* — a purchasable thing recorded on an expense with quantity and
rate, as opposed to a lump-sum category amount.

**Add Expense form [I] [A]:** Expense Number, Date, Category, Party (optional), line items or a lump
sum, GST toggle with tax rate, payment mode, paid / unpaid with a balance, notes, attachment.

### 7.4 Other purchase documents **[O sidebar ref-05]**

| Screen | Route | Notes |
|---|---|---|
| Purchase Order | `/purchase/orders` | Mirrors Sale Order; converts to a Purchase Bill |
| Purchase Return / Dr. Note | `/purchase/debit-notes` | Mirrors Credit Note |

---

## 8. Cash & Bank **[I sidebar] [B]**

The group is collapsed in every screenshot, so all contents come from the brief.

| Screen | Route | Contents |
|---|---|---|
| Cash In Hand | `/cash-bank/cash` | Running cash balance, a dated ledger of every cash movement, and an **Adjust Cash** action (add / reduce with a reason) |
| Bank Accounts | `/cash-bank/banks` | Account list with balances; add account (display name, account number, IFSC, UPI ID for the invoice QR, opening balance and as-of date); per-account statement |
| Transfers | `/cash-bank/transfers` | Bank to bank, cash to bank, bank to cash, with date, amount, reference, description |
| Cheques | `/cash-bank/cheques` | Cheque register with status **Open / Deposited / Withdrawn**, plus re-open and bounce actions. Rows are created automatically when a payment uses the Cheque mode |
| Loan Accounts | `/cash-bank/loans` | Lender, account number, opening balance, interest rate, terms; EMI and charge entries; current outstanding |

---

## 9. Reports **[O ref-08]**

`Reports` opens a **flyout panel** over the content area with its own collapse chevron and internal
scroll. Items are grouped under grey section headers. Observed, verbatim:

**Transaction report** — `Sale`, `Purchase`, `Day book`, `All Transactions`, `Profit And Loss`,
`Bill Wise Profit`*, `Cash flow`, `Trial Balance Report`* (with a red "new" dot), `Balance Sheet`*

**Party report** — `Party Statement`, `Party wise Profit & Loss`*, `All parties`,
`Party Report By Item`, `Sale Purchase By Party`, `Sale Purchase By Party Group`

**GST reports** — `GSTR 1`, `GSTR 2`, `GSTR 3 B`, … (cut off by the viewport)

Below the fold **[I from the brief]**: the remaining GST reports plus Item / Stock reports
(`Stock Summary`, `Item Report By Party`, `Item wise Profit & Loss`, `Low Stock Summary`,
`Stock Detail`), Business Status, and Taxes (`GST Rate Report`, `HSN summary`, `Expense report`,
`Bank Statement`, `Discount Report`, `Loan Statement`).

### 9.1 Shared report chrome **[B + A]**

Every report page carries: a date-range filter with the same period presets, filters relevant to that
report (party, item, category, firm, user), a totals row, server-side paginated results, and
**Export to Excel** plus **Export to PDF** and **Print** actions.

### 9.2 Report catalogue (target)

| Group | Report | Route | Source |
|---|---|---|---|
| Transaction | Sale | `/reports/sale` | **[O]** |
| Transaction | Purchase | `/reports/purchase` | **[O]** |
| Transaction | Day Book | `/reports/day-book` | **[O]** |
| Transaction | All Transactions | `/reports/all-transactions` | **[O]** |
| Transaction | Profit & Loss | `/reports/profit-loss` | **[O]** |
| Transaction | Bill Wise Profit | `/reports/bill-wise-profit` | **[O]** |
| Transaction | Cash Flow | `/reports/cash-flow` | **[O]** |
| Transaction | Trial Balance | `/reports/trial-balance` | **[O]** |
| Transaction | Balance Sheet | `/reports/balance-sheet` | **[O]** |
| Party | Party Statement | `/reports/party-statement` | **[O]** |
| Party | Party wise Profit & Loss | `/reports/party-profit-loss` | **[O]** |
| Party | All Parties | `/reports/all-parties` | **[O]** |
| Party | Party Report By Item | `/reports/party-by-item` | **[O]** |
| Party | Sale Purchase By Party | `/reports/sale-purchase-by-party` | **[O]** |
| Party | Sale Purchase By Party Group | `/reports/sale-purchase-by-group` | **[O]** |
| GST | GSTR-1 (+ JSON / Excel export in the offline-tool format) | `/reports/gst/gstr-1` | **[O + B]** |
| GST | GSTR-2 | `/reports/gst/gstr-2` | **[O]** |
| GST | GSTR-3B | `/reports/gst/gstr-3b` | **[O]** |
| GST | GST Rate report | `/reports/gst/rate-report` | **[B]** |
| GST | HSN summary | `/reports/gst/hsn-summary` | **[B]** |
| Stock | Stock Summary | `/reports/stock-summary` | **[B]** |
| Stock | Item wise Profit | `/reports/item-profit` | **[B]** |
| Stock | Low Stock | `/reports/low-stock` | **[B]** |
| Stock | Stock Detail | `/reports/stock-detail` | **[B]** |
| Other | Bank Statement | `/reports/bank-statement` | **[B]** |
| Other | Expense report | `/reports/expenses` | **[B]** |

---

## 10. Utilities **[O ref-09, ref-10]**

### 10.1 Import Items — `/utilities/import-items` **[O ref-09]**

Page title `Import Items`, then a centred `Select Import Method` heading and a radio-card chooser:

- **`Import From Barcode`** — crown, a `RECOMMENDED` pill, selected radio, blurb "Import item details
  by scanning barcodes. Uses a library of 100 Mn+ standard barcodes…"
- **`Import From Excel`** — "Import item data from excel files in your system"
- an `OR` divider, then a full-width row **`Import From Vyapar Library`** — "Import items from
  Vyapar's database"
- A **`Continue`** button pinned bottom-right.

**[A]** Only **Import From Excel** is in scope. Barcode and the hosted item library are dropped, so
the chooser collapses and the route goes straight to the Excel flow:
**1** download template -> **2** upload `.xlsx` -> **3** map columns to fields -> **4** validate with a
per-row error report -> **5** confirm and import, showing created / updated / skipped counts.
The same four-step component serves Import Parties.

### 10.2 Set Up My Business — `/onboarding` **[O ref-10]**

A **full-screen modal** with a close `X`, split into a form on the left and a **live invoice preview**
on the right. This is the most valuable reference in the set because the preview enumerates every
field the printed invoice needs.

**Left — `Enter Business Details`:** `Company Name*` (pre-filled `BELLA EVENT'S`),
`Phone Number*` (`9946050006`), `Choose Business Category*` (a `Select` dropdown), with `Cancel` and
a disabled `Next ->` at the bottom. So it is a **multi-step wizard**; later steps are not captured.
**[A]** Remaining steps: GSTIN and state, address, logo upload, financial-year start, and a
tax / non-tax invoice choice.

**Right — `Sample Tax Invoice` preview**, which resolves the print layout for §11:

- **Firm header block** — logo tile, firm name, address (`Ground Floor, Thiruvambady Devasam,
  Patthayappura Complex, Thrissur,`), `Phone:`, `Email:`, `GSTIN:`, `State:`
- **Bill To** (party name, address, contact number) and **Invoice Details** (`No:`, `Date:`)
- **Line table** — `#`, `Item name`, `HSN/SAC`, `Qty`, `Unit`, `Price/Unit`, `GST`, `Amount`,
  with a `Total` row
- **Tax Summary** — `HSN/SAC`, `Taxable amount`, then grouped `CGST` (Rate %, Amount) and `SGST`
  (Rate %, Amount), and `Total Tax`, with a `TOTAL` row
- **Totals block** — `Sub Total`, `Total`, `Invoice Amount in Words`, `Received`, `Balance`
- **Terms & Conditions** — "Thanks for doing business with us!"
- **Signature block** — `For <My Company>` with `Authorised Signatory`

### 10.3 Other utilities **[O ref-09/ref-10 sidebar]**

| Item | Route | Scope |
|---|---|---|
| Import Items | `/utilities/import-items` | In — Excel only |
| Import Parties | `/utilities/import-parties` | In — Excel |
| Export Items | `/utilities/export-items` | In — Excel |
| Set Up My Business | `/onboarding` | In |
| Accountant Access | `/settings/users` | In — the brief's users and roles, later phase |
| Verify My Data | `/utilities/verify-data` | In — recomputes ledger, stock and cached balances and reports any drift. Direct support for the "ledger-derived balances" principle |
| Recycle Bin | `/utilities/recycle-bin` | In — restore soft-deleted transactions |
| Barcode Generator, Update Items In Bulk, Import / Export Tally, Track Your Salesmen | — | Out |

**[B]** Also required and not in the references: full data export (JSON + Excel), and
**financial-year close / carry-forward** of balances.

### 10.4 Sync, Share & Backup **[I sidebar]**

**[A]** On the web, sync is implicit. This group reduces to: **Auto Backup** toggle and schedule,
**Download backup** (JSON), **Restore from backup**, and a backup history list — matching the
`Backup & History` block in ref-11 (§12.1).

---

## 11. Invoice printing and sharing **[O ref-10 preview] [B]**

**[A]** A `/print/[transactionId]` preview screen with a theme picker, paper-size selector,
field toggles, and `Download PDF`, `Print` and `Share on WhatsApp` actions.

- **Themes** — at least three A4 layouts plus one thermal layout at 80mm and 58mm, per the brief.
  All three A4 themes carry the full block list from §10.2.
- **Copy labels** — Original / Duplicate / Triplicate, per the brief.
- **Optional blocks** — firm logo, signature image, bank details, **UPI QR code**, terms and
  conditions, **amount in words** (Indian system), **HSN summary**. Each is toggled by a Print setting
  (§12.1 PRINT tab).
- **WhatsApp share** — a `wa.me` link carrying a message and a link to the generated PDF.

---

## 12. Settings **[O ref-11]**

A **full-screen overlay** with a `Settings` heading, a search icon, a left tab rail, and a close `X`.

Tabs, verbatim: `GENERAL`, `TRANSACTION`, `PRINT`, `TAXES & GST`, `TRANSACTION MESSAGE`, `PARTY`,
`ITEM`, `SERVICE REMINDERS`*, `ACCOUNTING`*, `MULTI CURRENCY`*.

### 12.1 GENERAL tab **[O ref-11]** — a three-column layout

**Column 1 — `Application`**

| Control | State in ref |
|---|---|
| `Enable Passcode` | unchecked |
| `Business Currency` | dropdown showing `Rs` |
| `Amount (upto Decimal Places)` | numeric stepper `2`, hint `e.g. 0.00` |
| `GSTIN Number` | **checked** |
| `Stop Sale on Negative Stock` | unchecked — explains the negative quantities in ref-03 |
| `Block New Items from Txn Form` | unchecked |
| `Block New Parties from Txn Form` | unchecked |

**`More Transactions`** — these toggles **show and hide whole sidebar sections**:
`Estimate/Quotation` **checked**, `Proforma Invoice` **checked**, `Sale/Purchase Order` **checked**,
`Other Income` unchecked, `Fixed Assets (FA)` unchecked, `Delivery Challan` **checked**, and nested
beneath it `Goods return on Delivery Challan` **checked** and `Print amount in Delivery Challan`
(cut off). Every control has an info tooltip.

**Column 2**

- `Multi Firm`* checkbox, then a firm card: radio-selected `BELLA EVENT'S`, a `DEFAULT ·` label, an
  `ALL DEVICES` pill with a globe, and an edit pencil.
- **`Stock Transfer Between Godowns`** — a paragraph of explanation and a checked
  `Godown management & Stock transfer` toggle carrying info, video and crown icons. *(Out of scope.)*

**Column 3**

- **`Backup & History`** — `Auto Backup` unchecked, a `Last Backup 05/03/2026 | 12:03 PM` line with an
  info icon, and `Audit Trail` **checked** — the brief's audit log has a real UI switch here.
- **`Customize Your View`** — `Choose Your Screen Zoom/Scale`, a slider with stops
  `70 / 80 / 90 / 100 / 115 / 120 / 130` (`115` appears in place of `110` on the tick labels;
  **[A]** we use 70–130 in ten-point steps) and an `Apply` button.

### 12.2 Remaining tabs **[I from tab names + B]**

| Tab | Expected contents |
|---|---|
| **TRANSACTION** | Per-type prefixes and numbering, FY reset behaviour, default due days / payment terms, show-hide of line fields (discount, free quantity, description, additional charges), round-off toggle and mode, transaction-wise tax and discount defaults |
| **PRINT** | Theme, paper size, margins, which blocks print (logo, signature, bank details, UPI QR, terms, amount in words, HSN summary), copy labels, printer type |
| **TAXES & GST** | Enable GST, firm GSTIN, composition scheme, enable cess, enable TCS, tax-rate master, HSN enable, place-of-supply defaults |
| **TRANSACTION MESSAGE** | SMS / WhatsApp templates per transaction type, with variable placeholders and a send-on-save toggle |
| **PARTY** | Enable party grouping, credit limit, shipping address, party custom field labels, opening-balance behaviour |
| **ITEM** | Stock maintenance on/off, enable units, categories, wholesale price, item custom field labels, low-stock alert on/off, item images |
| **SERVICE REMINDERS / ACCOUNTING / MULTI CURRENCY** | *Out of scope* |
| **Users & roles [B]** | Owner / Admin / Salesman / Accountant with a permission matrix — a later phase. Reached from `Accountant Access` in Utilities |

---

## 13. Formatting rules harvested from the references **[O]**

| Rule | Evidence |
|---|---|
| Indian digit grouping | `1,38,12,793`, `13,21,350.08`, `7,33,500.00` |
| Currency prefix `Rs` with no space before the digits | every money cell |
| 2 dp in tables and detail panes, 0 dp on dashboard KPI cards | ref-02/ref-04 vs ref-01 |
| Dates `DD/MM/YYYY` | `19/09/2026`, `01/09/2026 To 30/09/2026` |
| Timestamps `DD/MM/YYYY \| hh:mm AM` | `Last Backup 05/03/2026 \| 12:03 PM` |
| Relative-activity timestamps read `DD/MM/YYYY at h:mm am` (lowercase meridiem) | ref-12 `Last Sale Created: 21/09/2026 at 10:45 am` |
| Negative quantities in red, zero in grey, positive in the default colour | ref-03 |
| Receivable green / payable red-pink | ref-01, ref-02 |
| Percentage deltas to 2 dp on lists, 0 dp on the dashboard | `390.18%` vs `390%` |
| Blank invoice-number prefixes must be legal | `428`–`434` in ref-04 |
| Financial year runs April–March; the captures sit in FY 2026-27 | dates + brief |

---

## 14. Assumption register

Every **[A]** above, collected for sign-off. Flag any you disagree with and I will revise before code.

| # | Assumption |
|---|---|
| A-01 | App name is the placeholder **Bella Books**; palette, logo and icon set are original |
| A-02 | Desktop window chrome becomes a slim web utility strip; no support phone numbers |
| A-03 | Upsell card, premium CTA and all crown badges are removed; every built feature ships unlocked |
| A-04 | Out of scope: Loyalty Points, Vyapar Network, Godowns, POS, the whole Grow Your Business group, Tally import/export, Barcode Generator, Bulk item update, Track Salesmen, Plans & Pricing, OCR bill upload, barcode and hosted-library item import |
| A-05 | The circular `+` in the top bar opens a menu of all remaining record types |
| A-06 | Vyapar's two plan banners collapse into one generic dismissable `SystemBanner` |
| A-07 | Dashboard KPI cards show whole rupees; every other surface shows 2 dp |
| A-08 | Dashboard period presets: Today, This Week, This Month, Last Month, This Quarter, This FY, Last FY, Custom |
| A-09 | A zero previous period renders the delta as `—`, not an infinite percentage |
| A-10 | The dashboard right rail is a real user-configurable widget rail with the catalogue in §3.3 |
| A-11 | "Most Used Reports" is driven by a per-user open counter with the four observed defaults |
| A-12 | Dashboard quick actions live only in the top bar, not duplicated as dashboard tiles |
| A-13 | The party list's phone/Gmail import promo becomes an Excel-import strip |
| A-14 | The third icon on the party detail header is a payment-reminder action |
| A-15 | Party and item forms are tabbed dialogs with the field groups listed in §4.2 and §5.2 |
| A-16 | Negative stock is permitted by default, governed by `Stop Sale on Negative Stock` |
| A-17 | Adjust Item writes a `StockMovement` of type `ADJUSTMENT`; no stored counter is ever edited |
| A-18 | One filter-bar treatment (the ref-04 pill style) is used on every list screen |
| A-19 | Expense categories carry a Direct / Indirect expense type, per the `Direct Expense` sub-label |
| A-20 | Conversions are exposed in the row kebab and stamp the source with `convertedToId` so it cannot be converted twice |
| A-21 | Payment allocation offers auto-allocate oldest-first; any remainder becomes on-account credit |
| A-22 | Import is a five-step Excel wizard shared by items and parties |
| A-23 | Onboarding wizard steps beyond the captured first: GSTIN and state, address, logo, FY start, tax/non-tax invoice |
| A-24 | `Verify My Data` recomputes ledger, stock and cached balances and reports drift |
| A-25 | Sync, Share & Backup reduces on the web to auto-backup, download, restore and history |
| A-26 | The screen zoom slider runs 70–130 in ten-point steps |
| A-27 | The invoice print layout follows the ref-10 preview block-for-block across all three A4 themes |
| A-28 | Mobile and tablet layouts are entirely my design: the sidebar becomes a drawer, master–detail becomes a drill-down, and wide tables become stacked cards |
| A-29 | Mobile-OTP auth is deferred; `mobile` and `mobileVerified` columns are reserved now |
| A-30 | **Company and Firm are two distinct levels** (§2.6), deviating from the brief's single `Firm`. Company is the tenant; firms live inside it |
| A-31 | Parties, items, units and categories are **company-level and shared across firms**; transactions are **firm-tagged**. Inferred from where the `All Firms` filter does and does not appear |
| A-32 | `.vyp` file browsing, the `SYNC ON/OFF` indicator and the refresh button are dropped — they are desktop-file-sync concepts with no web equivalent |
| A-33 | The company-row kebab offers Rename, Share, Backup, Delete and (dropped) sync toggle |
| A-34 | `Companies Shared with Me` and `Accountant Access` are one feature with two entry points, shipped in the users-and-roles phase |
| A-35 | The sidebar footer company switcher opens the Company List rather than an inline dropdown |

---

## 15. Coverage check

| Brief section | Covered in |
|---|---|
| 4.1 Auth & onboarding | §2, §2.5, §2.6, §10.2 |
| 4.2 Dashboard | §3 |
| 4.3 Parties | §4 |
| 4.4 Items | §5 |
| 4.5 Sales | §6 |
| 4.6 Purchases | §7.1, §7.2, §7.4 |
| 4.7 Expenses | §7.3 |
| 4.8 Cash & Bank | §8 |
| 4.9 Printing & sharing | §11 |
| 4.10 Reports | §9 |
| 4.11 Settings | §12 |
| 4.12 Utilities | §10 |

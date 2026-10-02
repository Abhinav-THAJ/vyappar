/**
 * The model registry the tenancy guard works from.
 *
 * `tests/unit/tenancy.test.ts` reads prisma/schema.prisma and fails if either
 * list drifts from the schema, so adding a model without classifying it is a
 * test failure rather than a silent cross-tenant leak (D-18).
 */

/** Models carrying a `companyId`. Every query against these is scoped. */
export const COMPANY_SCOPED_MODELS = [
  "Firm",
  "Settings",
  "PartyGroup",
  "Party",
  "Unit",
  "ItemCategory",
  "TaxRate",
  "Item",
  "ExpenseCategory",
  "Transaction",
  "TransactionLine",
  "TransactionTax",
  "PaymentAllocation",
  "StockMovement",
  "LedgerEntry",
  "BankAccount",
  "Cheque",
  "LoanAccount",
  "LoanTransaction",
  "NumberSequence",
  "Attachment",
  "AuditLog",
] as const;

/** Models carrying a `deletedAt`, filtered out of reads by default. */
export const SOFT_DELETE_MODELS = [
  "Company",
  "Firm",
  "PartyGroup",
  "Party",
  "Unit",
  "ItemCategory",
  "TaxRate",
  "Item",
  "ExpenseCategory",
  "Transaction",
  "BankAccount",
  "LoanAccount",
] as const;

/**
 * Models deliberately outside the company scope: identity, the tenant row
 * itself, and a pure join table whose parents are already scoped.
 */
export const UNSCOPED_MODELS = [
  "User",
  "PasswordResetToken",
  "Company",
  "CompanyMember",
  "ItemCategoryOnItem",
] as const;

/**
 * Models that carry a `companyId` and are nonetheless deliberately unscoped.
 *
 * `CompanyMember` is the only one: it is the table consulted to decide *which*
 * company the caller may access, so scoping it by the active company would be
 * circular — a user could never discover the companies they belong to, and
 * `requireCompany()` could not verify membership. It is read exclusively
 * through `lib/auth/session.ts`, always filtered by `userId`.
 *
 * Anything added here needs the same standard of justification.
 */
export const UNSCOPED_WITH_COMPANY_ID = ["CompanyMember"] as const;

export const companyScopedSet: ReadonlySet<string> = new Set(COMPANY_SCOPED_MODELS);
export const softDeleteSet: ReadonlySet<string> = new Set(SOFT_DELETE_MODELS);
export const unscopedSet: ReadonlySet<string> = new Set(UNSCOPED_MODELS);

export const unscopedWithCompanyIdSet: ReadonlySet<string> = new Set(UNSCOPED_WITH_COMPANY_ID);

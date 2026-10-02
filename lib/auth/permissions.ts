import type { Role } from "@prisma/client";

/**
 * Every guarded capability in the application. Server actions name one of
 * these; `withPermission()` checks it before the action body runs.
 */
export const PERMISSIONS = [
  "company.manage", // rename, delete, invite members, change roles
  "firm.manage", // create and edit firms inside a company
  "settings.write",
  "party.read",
  "party.write",
  "item.read",
  "item.write",
  "sale.read",
  "sale.write",
  "purchase.read",
  "purchase.write",
  "expense.read",
  "expense.write",
  "cashbank.read",
  "cashbank.write",
  "report.read",
  "report.gst",
  "transaction.delete",
  "data.export",
  "data.import",
  "audit.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: readonly Permission[] = PERMISSIONS;

/**
 * Role -> permission matrix.
 *
 * OWNER      everything, including deleting the company
 * ADMIN      everything operational; cannot manage the company itself
 * ACCOUNTANT read everything, write transactions and reports; no masters or settings
 * SALESMAN   sales side only, and cannot delete
 */
const MATRIX: Record<Role, readonly Permission[]> = {
  OWNER: ALL,
  ADMIN: ALL.filter((p) => p !== "company.manage"),
  ACCOUNTANT: [
    "party.read",
    "party.write",
    "item.read",
    "sale.read",
    "sale.write",
    "purchase.read",
    "purchase.write",
    "expense.read",
    "expense.write",
    "cashbank.read",
    "cashbank.write",
    "report.read",
    "report.gst",
    "data.export",
    "audit.read",
  ],
  SALESMAN: [
    "party.read",
    "party.write",
    "item.read",
    "sale.read",
    "sale.write",
    "report.read",
  ],
};

export function permissionsFor(role: Role): readonly Permission[] {
  return MATRIX[role];
}

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  ACCOUNTANT: "Accountant",
  SALESMAN: "Salesman",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER: "Full access, including company settings and member management.",
  ADMIN: "Full operational access. Cannot rename or delete the company.",
  ACCOUNTANT: "Books and reports. Cannot change items or settings.",
  SALESMAN: "Sales documents and parties only. Cannot delete.",
};

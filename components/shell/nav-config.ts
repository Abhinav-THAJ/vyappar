import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BarChart3,
  Building2,
  FileSpreadsheet,
  Home,
  Landmark,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Users,
  Wrench,
} from "lucide-react";
import type { Permission } from "@/lib/auth/permissions";

export interface NavLeaf {
  label: string;
  href: string;
  /** Route for the sidebar quick-add "+" button, where the reference has one. */
  quickAdd?: string;
  permission?: Permission;
  /** Hidden unless the named "More Transactions" settings toggle is on (ref-11). */
  requiresSetting?: string;
  badge?: "new";
}

export interface NavGroup {
  label: string;
  icon: LucideIcon;
  /** A group with an href and no children is a plain link. */
  href?: string;
  children?: NavLeaf[];
  permission?: Permission;
  /** Reports opens a flyout panel rather than expanding in place (ref-08). */
  flyout?: boolean;
}

/**
 * The navigation tree, mirroring the reference app minus the modules the brief
 * puts out of scope (godowns, POS, loyalty, the Grow Your Business group,
 * Tally, barcode tooling, plans & pricing). See SCREEN_INVENTORY.md §1.2.
 */
export const NAV: NavGroup[] = [
  { label: "Home", icon: Home, href: "/dashboard" },

  {
    label: "Parties",
    icon: Users,
    permission: "party.read",
    children: [
      { label: "Party Details", href: "/parties", quickAdd: "/parties?new=1" },
      { label: "Party Groups", href: "/parties/groups" },
    ],
  },

  {
    label: "Items",
    icon: Package,
    permission: "item.read",
    children: [
      { label: "Item Details", href: "/items", quickAdd: "/items?new=1" },
      { label: "Categories", href: "/items/categories" },
      { label: "Units", href: "/items/units" },
    ],
  },

  {
    label: "Sale",
    icon: Receipt,
    permission: "sale.read",
    children: [
      { label: "Sale Invoices", href: "/sale/invoices", quickAdd: "/sale/invoices/new" },
      {
        label: "Estimate/ Quotation",
        href: "/sale/estimates",
        quickAdd: "/sale/estimates/new",
        requiresSetting: "enableEstimate",
      },
      {
        label: "Proforma Invoice",
        href: "/sale/proforma",
        quickAdd: "/sale/proforma/new",
        requiresSetting: "enableProforma",
      },
      { label: "Payment-In", href: "/sale/payments-in", quickAdd: "/sale/payments-in/new" },
      {
        label: "Sale Order",
        href: "/sale/orders",
        quickAdd: "/sale/orders/new",
        requiresSetting: "enableOrders",
      },
      {
        label: "Delivery Challan",
        href: "/sale/challans",
        quickAdd: "/sale/challans/new",
        requiresSetting: "enableDeliveryChallan",
      },
      {
        label: "Sale Return/ Credit Note",
        href: "/sale/credit-notes",
        quickAdd: "/sale/credit-notes/new",
      },
    ],
  },

  {
    label: "Purchase & Expense",
    icon: ShoppingCart,
    permission: "purchase.read",
    children: [
      { label: "Purchase Bills", href: "/purchase/bills", quickAdd: "/purchase/bills/new" },
      { label: "Payment-Out", href: "/purchase/payments-out", quickAdd: "/purchase/payments-out/new" },
      { label: "Expenses", href: "/expenses", quickAdd: "/expenses?new=1", permission: "expense.read" },
      {
        label: "Purchase Order",
        href: "/purchase/orders",
        quickAdd: "/purchase/orders/new",
        requiresSetting: "enableOrders",
      },
      {
        label: "Purchase Return/ Dr. Note",
        href: "/purchase/debit-notes",
        quickAdd: "/purchase/debit-notes/new",
      },
    ],
  },

  {
    label: "Cash & Bank",
    icon: Landmark,
    permission: "cashbank.read",
    children: [
      { label: "Bank Accounts", href: "/cash-bank/banks" },
      { label: "Cash In Hand", href: "/cash-bank/cash" },
      { label: "Transfers", href: "/cash-bank/transfers" },
      { label: "Cheques", href: "/cash-bank/cheques" },
      { label: "Loan Accounts", href: "/cash-bank/loans" },
    ],
  },

  { label: "Reports", icon: BarChart3, flyout: true, permission: "report.read" },

  {
    label: "Sync, Share & Backup",
    icon: ArrowLeftRight,
    children: [
      { label: "Backup & Restore", href: "/utilities/backup" },
      { label: "Company Sharing", href: "/settings/users", permission: "company.manage" },
    ],
  },

  {
    label: "Utilities",
    icon: Wrench,
    children: [
      { label: "Migrate Old Software Data", href: "/utilities/migration", permission: "data.import" },
      { label: "Import Transactions", href: "/utilities/import-transactions", permission: "data.import" },
      { label: "Import Items", href: "/utilities/import-items", permission: "data.import" },
      { label: "Import Parties", href: "/utilities/import-parties", permission: "data.import" },
      { label: "Export Items", href: "/utilities/export-items", permission: "data.export" },
      { label: "Set Up My Business", href: "/settings/firms" },
      { label: "Accountant Access", href: "/settings/users", permission: "company.manage" },
      { label: "Verify My Data", href: "/utilities/verify-data" },
      { label: "Recycle Bin", href: "/utilities/recycle-bin" },
      { label: "Close Financial Year", href: "/utilities/fy-close", permission: "settings.write" },
    ],
  },

  { label: "Settings", icon: Settings, href: "/settings" },
];

/** The report flyout, grouped exactly as ref-08 groups it. */
export interface ReportGroup {
  label: string;
  items: { label: string; href: string; permission?: Permission }[];
}

export const REPORT_GROUPS: ReportGroup[] = [
  {
    label: "Transaction report",
    items: [
      { label: "Sale", href: "/reports/sale" },
      { label: "Purchase", href: "/reports/purchase" },
      { label: "Day book", href: "/reports/day-book" },
      { label: "All Transactions", href: "/reports/all-transactions" },
      { label: "Profit And Loss", href: "/reports/profit-loss" },
      { label: "Bill Wise Profit", href: "/reports/bill-wise-profit" },
      { label: "Cash flow", href: "/reports/cash-flow" },
      { label: "Trial Balance Report", href: "/reports/trial-balance" },
      { label: "Balance Sheet", href: "/reports/balance-sheet" },
    ],
  },
  {
    label: "Party report",
    items: [
      { label: "Party Statement", href: "/reports/party-statement" },
      { label: "Party wise Profit & Loss", href: "/reports/party-profit-loss" },
      { label: "All parties", href: "/reports/all-parties" },
      { label: "Party Report By Item", href: "/reports/party-by-item" },
      { label: "Sale Purchase By Party", href: "/reports/sale-purchase-by-party" },
      { label: "Sale Purchase By Party Group", href: "/reports/sale-purchase-by-group" },
    ],
  },
  {
    label: "Item / Stock report",
    items: [
      { label: "Stock Summary", href: "/reports/stock-summary" },
      { label: "Item wise Profit", href: "/reports/item-profit" },
      { label: "Low Stock Summary", href: "/reports/low-stock" },
      { label: "Stock Detail", href: "/reports/stock-detail" },
    ],
  },
  {
    label: "GST reports",
    items: [
      { label: "GSTR 1", href: "/reports/gst/gstr-1", permission: "report.gst" },
      { label: "GSTR 2", href: "/reports/gst/gstr-2", permission: "report.gst" },
      { label: "GSTR 3B", href: "/reports/gst/gstr-3b", permission: "report.gst" },
      { label: "GST Rate Report", href: "/reports/gst/rate-report", permission: "report.gst" },
      { label: "HSN Summary", href: "/reports/gst/hsn-summary", permission: "report.gst" },
    ],
  },
  {
    label: "Other reports",
    items: [
      { label: "Bank Statement", href: "/reports/bank-statement" },
      { label: "Expense report", href: "/reports/expenses" },
    ],
  },
];

/** Flat list of every report, for the command palette. */
export const ALL_REPORTS = REPORT_GROUPS.flatMap((g) =>
  g.items.map((i) => ({ ...i, group: g.label })),
);

export const QUICK_ADD_ITEMS: {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
}[] = [
  { label: "Payment-In", href: "/sale/payments-in/new", icon: Receipt, permission: "sale.write" },
  { label: "Payment-Out", href: "/purchase/payments-out/new", icon: Receipt, permission: "purchase.write" },
  { label: "Expense", href: "/expenses?new=1", icon: FileSpreadsheet, permission: "expense.write" },
  { label: "Estimate/ Quotation", href: "/sale/estimates/new", icon: Receipt, permission: "sale.write" },
  { label: "Sale Order", href: "/sale/orders/new", icon: Receipt, permission: "sale.write" },
  { label: "Purchase Order", href: "/purchase/orders/new", icon: ShoppingCart, permission: "purchase.write" },
  { label: "Delivery Challan", href: "/sale/challans/new", icon: Receipt, permission: "sale.write" },
  { label: "Credit Note", href: "/sale/credit-notes/new", icon: Receipt, permission: "sale.write" },
  { label: "Debit Note", href: "/purchase/debit-notes/new", icon: ShoppingCart, permission: "purchase.write" },
  { label: "Party", href: "/parties?new=1", icon: Users, permission: "party.write" },
  { label: "Item", href: "/items?new=1", icon: Package, permission: "item.write" },
  { label: "Firm", href: "/settings/firms", icon: Building2, permission: "firm.manage" },
];

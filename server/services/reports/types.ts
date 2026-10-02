import type { Permission } from "@/lib/auth/permissions";

export type ColumnFormat = "text" | "money" | "qty" | "date" | "percent" | "number";

export interface ReportColumn {
  key: string;
  label: string;
  format?: ColumnFormat;
  align?: "left" | "right" | "center";
  /** Include this column in the totals row. */
  total?: boolean;
  /** Hide on narrow screens. */
  secondary?: boolean;
}

export type ReportCell = string | number | null;
export type ReportRow = Record<string, ReportCell> & { _id?: string; _group?: string };

export interface ReportResult {
  rows: ReportRow[];
  totals?: Record<string, number>;
  /** Extra headline figures shown above the table. */
  summary?: { label: string; value: string; tone?: "positive" | "negative" | "neutral" }[];
  /** Optional note explaining the basis of the figures. */
  note?: string;
}

export interface ReportFilters {
  from: Date;
  to: Date;
  firmId: string | null;
  partyId: string | null;
  itemId: string | null;
  categoryId: string | null;
  q: string;
  fyStartMonth: number;
}

export interface ReportContext {
  companyId: string;
  firmStateCode: string;
}

export interface ReportDefinition {
  /** URL slug under /reports, e.g. "sale" or "gst/gstr-1". */
  slug: string;
  title: string;
  description: string;
  group: string;
  permission?: Permission;
  columns: ReportColumn[];
  /** Report needs a specific firm — GST returns are filed per GSTIN. */
  requiresFirm?: boolean;
  /** Offer a party filter. */
  partyFilter?: boolean;
  /** Offer an item filter. */
  itemFilter?: boolean;
  /** Date range is meaningless for this report (stock on hand, say). */
  pointInTime?: boolean;
  run: (ctx: ReportContext, filters: ReportFilters) => Promise<ReportResult>;
}

import type { ReportDefinition } from "./types";
import {
  saleReport,
  purchaseReport,
  allTransactionsReport,
  dayBookReport,
  profitLossReport,
  cashFlowReport,
  billWiseProfitReport,
  trialBalanceReport,
  balanceSheetReport,
} from "./transaction-reports";
import {
  partyStatementReport,
  allPartiesReport,
  salePurchaseByPartyReport,
  salePurchaseByGroupReport,
  partyProfitLossReport,
  partyByItemReport,
  stockSummaryReport,
  lowStockReport,
  stockDetailReport,
  itemProfitReport,
  expenseReport,
  bankStatementReport,
} from "./party-item-reports";
import {
  gstr1Report,
  gstr2Report,
  gstr3bReport,
  gstRateReport,
  hsnSummaryReport,
} from "./gst-reports";

/** Every report, in the order the Reports flyout lists them. */
export const REPORTS: ReportDefinition[] = [
  // Transaction
  saleReport,
  purchaseReport,
  dayBookReport,
  allTransactionsReport,
  profitLossReport,
  billWiseProfitReport,
  cashFlowReport,
  trialBalanceReport,
  balanceSheetReport,

  // Party
  partyStatementReport,
  partyProfitLossReport,
  allPartiesReport,
  partyByItemReport,
  salePurchaseByPartyReport,
  salePurchaseByGroupReport,

  // Stock
  stockSummaryReport,
  itemProfitReport,
  lowStockReport,
  stockDetailReport,

  // GST
  gstr1Report,
  gstr2Report,
  gstr3bReport,
  gstRateReport,
  hsnSummaryReport,

  // Other
  bankStatementReport,
  expenseReport,
];

const BY_SLUG = new Map(REPORTS.map((r) => [r.slug, r]));

export function findReport(slug: string): ReportDefinition | undefined {
  return BY_SLUG.get(slug);
}

export function reportsByGroup(): { group: string; reports: ReportDefinition[] }[] {
  const groups = new Map<string, ReportDefinition[]>();
  for (const report of REPORTS) {
    const list = groups.get(report.group) ?? [];
    list.push(report);
    groups.set(report.group, list);
  }
  return [...groups.entries()].map(([group, reports]) => ({ group, reports }));
}

export { buildGstr1Json } from "./gst-reports";
export type { ReportDefinition, ReportResult, ReportRow, ReportColumn } from "./types";

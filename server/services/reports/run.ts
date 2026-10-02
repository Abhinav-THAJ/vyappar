import { notFound } from "next/navigation";
import { requireCompany, type CompanyContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { readFilterParams } from "@/lib/filters";
import { findReport } from "./registry";
import type { ReportDefinition, ReportFilters, ReportResult } from "./types";

export interface RunReportOutcome {
  ctx: CompanyContext;
  report: ReportDefinition;
  filters: ReportFilters;
  result: ReportResult;
  firms: { id: string; name: string }[];
  activeFirmId: string | null;
}

/**
 * Resolve a report slug, check permission, apply the filters and run it.
 * Shared by the page and the export routes so both always agree.
 */
export async function runReport(
  slug: string,
  searchParams: Record<string, string | string[] | undefined>,
): Promise<RunReportOutcome> {
  const ctx = await requireCompany();
  const report = findReport(slug);
  if (!report) notFound();

  if (report.permission && !can(ctx.role, report.permission)) {
    notFound();
  }
  if (!can(ctx.role, "report.read")) notFound();

  const base = readFilterParams(searchParams, ctx.fyStartMonth);

  const firms = await ctx.db.firm.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true, name: true, stateCode: true },
  });

  const get = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  // GST returns are filed per GSTIN, so they always resolve to one firm.
  const activeFirmId = report.requiresFirm
    ? (base.firmId ?? firms[0]?.id ?? null)
    : base.firmId;

  const firmStateCode =
    firms.find((f) => f.id === activeFirmId)?.stateCode ?? firms[0]?.stateCode ?? "32";

  const filters: ReportFilters = {
    from: base.range.from,
    to: base.range.to,
    firmId: activeFirmId,
    partyId: get("partyId") ?? null,
    itemId: get("itemId") ?? null,
    categoryId: get("categoryId") ?? null,
    q: base.q,
    fyStartMonth: ctx.fyStartMonth,
  };

  const result = await report.run(
    { companyId: ctx.companyId, firmStateCode },
    filters,
  );

  return {
    ctx,
    report,
    filters,
    result,
    firms: firms.map((f) => ({ id: f.id, name: f.name })),
    activeFirmId,
  };
}

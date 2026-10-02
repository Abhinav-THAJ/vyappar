import type { Metadata } from "next";
import { FilterBar } from "@/components/patterns/filter-bar";
import { runReport } from "@/server/services/reports/run";
import { ReportView } from "@/components/reports/report-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { findReport } = await import("@/server/services/reports/registry");
  const report = findReport(slug.join("/"));
  return { title: report?.title ?? "Report" };
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const resolved = await searchParams;
  const key = slug.join("/");

  const { ctx, report, result, firms, activeFirmId } = await runReport(key, resolved);

  return (
    <div className="flex min-h-full flex-col">
      {!report.pointInTime ? (
        <div className="no-print">
          <FilterBar
            firms={report.requiresFirm ? [] : firms}
            fyStartMonth={ctx.fyStartMonth}
            showFirm={!report.requiresFirm}
            showUser={false}
          />
        </div>
      ) : null}

      <ReportView
        slug={key}
        title={report.title}
        description={report.description}
        columns={report.columns}
        result={result}
        partyFilter={!!report.partyFilter}
        itemFilter={!!report.itemFilter}
        requiresFirm={!!report.requiresFirm}
        firms={firms}
        activeFirmId={activeFirmId}
        isGstr1={key === "gst/gstr-1"}
      />
    </div>
  );
}

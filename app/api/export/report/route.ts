import { NextResponse } from "next/server";
import { runReport } from "@/server/services/reports/run";
import { buildWorkbook } from "@/lib/xlsx";
import { formatDate } from "@/lib/format/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "Missing report slug" }, { status: 400 });

  const searchParams: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    searchParams[key] = value;
  });

  try {
    const { report, result, filters } = await runReport(slug, searchParams);

    const buffer = buildWorkbook([
      {
        name: report.title,
        columns: report.columns.map((c) => ({ key: c.key, label: c.label })),
        rows: result.rows,
        totals: result.totals,
        preamble: [
          report.title,
          report.pointInTime
            ? `As at ${formatDate(filters.to)}`
            : `${formatDate(filters.from)} to ${formatDate(filters.to)}`,
          ...(result.note ? [result.note] : []),
        ],
      },
    ]);

    const fileName = `${report.slug.replace(/\//g, "-")}-${formatDate(filters.to).replace(/\//g, "-")}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[export/report] failed:", error);
    return NextResponse.json({ error: "Could not build the export" }, { status: 500 });
  }
}

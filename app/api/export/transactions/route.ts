import { NextResponse } from "next/server";
import { TransactionType } from "@prisma/client";
import { requireCompany } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { readFilterParams } from "@/lib/filters";
import { listTransactions } from "@/server/services/transactions";
import { buildWorkbook } from "@/lib/xlsx";
import { formatDate } from "@/lib/format/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Excel export for whatever transaction list the user is looking at. */
export async function GET(request: Request) {
  try {
    const ctx = await requireCompany();
    if (!can(ctx.role, "data.export")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const url = new URL(request.url);
    const searchParams: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      searchParams[key] = value;
    });

    const filters = readFilterParams(searchParams, ctx.fyStartMonth);
    const typeParam = url.searchParams.get("type");

    const types = typeParam
      ? [typeParam as TransactionType]
      : [
          TransactionType.SALE,
          TransactionType.PURCHASE,
          TransactionType.PAYMENT_IN,
          TransactionType.PAYMENT_OUT,
        ];

    // Export the whole filtered set, not just the page on screen.
    const { rows } = await listTransactions(ctx.companyId, {
      type: types,
      from: filters.range.from,
      to: filters.range.to,
      firmId: filters.firmId,
      q: filters.q,
      page: 1,
      pageSize: 10_000,
      sort: filters.sort,
      dir: filters.dir,
    });

    const buffer = buildWorkbook([
      {
        name: "Transactions",
        columns: [
          { key: "date", label: "Date" },
          { key: "displayNumber", label: "Number" },
          { key: "type", label: "Type" },
          { key: "partyName", label: "Party" },
          { key: "firmName", label: "Firm" },
          { key: "paymentMode", label: "Payment mode" },
          { key: "total", label: "Total" },
          { key: "paidAmount", label: "Received" },
          { key: "balanceAmount", label: "Balance" },
        ],
        rows: rows.map((r) => ({ ...r, date: formatDate(r.date) })),
        totals: {
          total: rows.reduce((a, r) => a + Number(r.total), 0),
          paidAmount: rows.reduce((a, r) => a + Number(r.paidAmount), 0),
          balanceAmount: rows.reduce((a, r) => a + Number(r.balanceAmount), 0),
        },
        preamble: [
          `Transactions for ${ctx.companyName}`,
          `${formatDate(filters.range.from)} to ${formatDate(filters.range.to)}`,
        ],
      },
    ]);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="transactions.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[export/transactions] failed:", error);
    return NextResponse.json({ error: "Could not build the export" }, { status: 500 });
  }
}

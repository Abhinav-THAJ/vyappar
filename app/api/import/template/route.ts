import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { buildTemplate, buildWorkbook } from "@/lib/xlsx";
import {
  PARTY_IMPORT,
  ITEM_IMPORT,
  TRANSACTION_IMPORT,
  specFor,
  templateColumns,
  templateExample,
} from "@/server/services/import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A starter workbook with the right headers and example rows. */
export async function GET(request: Request) {
  try {
    await requirePermission("data.import");

    const kind = new URL(request.url).searchParams.get("kind") || "all";

    if (kind === "all") {
      const buffer = buildWorkbook([
        {
          name: "1. Parties (Customers & Vendors)",
          columns: templateColumns(PARTY_IMPORT),
          rows: [templateExample(PARTY_IMPORT)],
          preamble: [
            "Bella Books Migration Workbook — Sheet 1: Customers & Suppliers",
            "Fill in your customers/vendors and their current Opening Balances (TO_RECEIVE or TO_PAY).",
          ],
        },
        {
          name: "2. Items (Inventory)",
          columns: templateColumns(ITEM_IMPORT),
          rows: [templateExample(ITEM_IMPORT)],
          preamble: [
            "Bella Books Migration Workbook — Sheet 2: Products & Inventory",
            "Fill in your items, selling prices, purchase costs, and Opening Stock quantities.",
          ],
        },
        {
          name: "3. Past Invoices & Bills",
          columns: templateColumns(TRANSACTION_IMPORT),
          rows: [templateExample(TRANSACTION_IMPORT)],
          preamble: [
            "Bella Books Migration Workbook — Sheet 3: Past Invoices & Bills",
            "Optional: Import past Sales, Purchases, or Expenses from previous software.",
          ],
        },
      ]);

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition":
            'attachment; filename="bella-books-complete-migration-template.xlsx"',
          "Cache-Control": "no-store",
        },
      });
    }

    if (kind !== "parties" && kind !== "items" && kind !== "transactions") {
      return NextResponse.json({ error: "Unknown template" }, { status: 400 });
    }

    const spec = specFor(kind);
    const buffer = buildTemplate(templateColumns(spec), templateExample(spec));

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${kind}-import-template.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[import/template] failed:", error);
    return NextResponse.json({ error: "Could not build the template" }, { status: 500 });
  }
}

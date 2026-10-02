import { NextResponse } from "next/server";
import { requireCompany } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listItems } from "@/server/services/items";
import { listParties } from "@/server/services/parties";
import { buildWorkbook } from "@/lib/xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Excel export of the item and party masters. */
export async function GET(request: Request) {
  try {
    const ctx = await requireCompany();
    if (!can(ctx.role, "data.export")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const what = new URL(request.url).searchParams.get("what") ?? "items";

    if (what === "parties") {
      const parties = await listParties(ctx.companyId);

      const buffer = buildWorkbook([
        {
          name: "Parties",
          columns: [
            { key: "name", label: "Party name", width: 30 },
            { key: "type", label: "Type" },
            { key: "phone", label: "Phone" },
            { key: "gstin", label: "GSTIN", width: 20 },
            { key: "groupName", label: "Group" },
            { key: "balance", label: "Balance" },
          ],
          rows: parties,
          preamble: [`Parties for ${ctx.companyName}`],
        },
      ]);

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="parties.xlsx"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const items = await listItems(ctx.companyId);

    const buffer = buildWorkbook([
      {
        name: "Items",
        columns: [
          { key: "name", label: "Item name", width: 34 },
          { key: "type", label: "Type" },
          { key: "sku", label: "Item code" },
          { key: "hsnSac", label: "HSN/SAC" },
          { key: "salePrice", label: "Sale price" },
          { key: "qty", label: "Stock" },
          { key: "minStockQty", label: "Minimum stock" },
        ],
        rows: items,
        preamble: [`Items for ${ctx.companyName}`],
      },
    ]);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="items.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[export/items] failed:", error);
    return NextResponse.json({ error: "Could not build the export" }, { status: 500 });
  }
}

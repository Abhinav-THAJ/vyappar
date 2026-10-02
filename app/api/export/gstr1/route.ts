import { NextResponse } from "next/server";
import { requireCompany } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { readFilterParams } from "@/lib/filters";
import { buildGstr1Json } from "@/server/services/reports/registry";
import { formatDate } from "@/lib/format/date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GSTR-1 in the shape the government offline tool accepts. */
export async function GET(request: Request) {
  try {
    const ctx = await requireCompany();
    if (!can(ctx.role, "report.gst")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const url = new URL(request.url);
    const searchParams: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      searchParams[key] = value;
    });

    const filters = readFilterParams(searchParams, ctx.fyStartMonth);

    // A GSTR-1 belongs to exactly one GSTIN, so resolve a single firm.
    const firm = filters.firmId
      ? await ctx.db.firm.findFirst({
          where: { id: filters.firmId, isActive: true },
          select: { id: true, name: true },
        })
      : await ctx.db.firm.findFirst({
          where: { isActive: true },
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
          select: { id: true, name: true },
        });

    if (!firm) {
      return NextResponse.json({ error: "No firm to file for" }, { status: 400 });
    }

    const json = await buildGstr1Json(
      ctx.companyId,
      firm.id,
      filters.range.from,
      filters.range.to,
    );

    const fileName = `GSTR1-${json.fp || formatDate(filters.range.to).replace(/\//g, "-")}.json`;

    return new NextResponse(JSON.stringify(json, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[export/gstr1] failed:", error);
    return NextResponse.json({ error: "Could not build the return" }, { status: 500 });
  }
}

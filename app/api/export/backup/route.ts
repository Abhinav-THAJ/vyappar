import { NextResponse } from "next/server";
import { requireCompany } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { exportCompanyData } from "@/server/services/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Full JSON backup of the active company. */
export async function GET() {
  try {
    const ctx = await requireCompany();
    if (!can(ctx.role, "data.export")) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }

    const data = await exportCompanyData(ctx.companyId);
    const stamp = new Date().toISOString().slice(0, 10);
    const safeName = ctx.companyName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${safeName}-backup-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[export/backup] failed:", error);
    return NextResponse.json({ error: "Could not build the backup" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { buildTemplate } from "@/lib/xlsx";
import { specFor, templateColumns, templateExample } from "@/server/services/import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A starter workbook with the right headers and one example row. */
export async function GET(request: Request) {
  try {
    await requirePermission("data.import");

    const kind = new URL(request.url).searchParams.get("kind");
    if (kind !== "parties" && kind !== "items") {
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

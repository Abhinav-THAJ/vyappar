import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { requireCompany } from "@/lib/auth/session";
import { getInvoiceDocument, upiPaymentUri } from "@/server/services/document";
import { InvoicePdf } from "@/components/pdf/invoice-pdf";

export const runtime = "nodejs";
// Rendering a PDF is per-request work; never cache the response.
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const theme = url.searchParams.get("theme") ?? "classic";
  const copyLabel = url.searchParams.get("copy") ?? undefined;

  try {
    const ctx = await requireCompany();
    const doc = await getInvoiceDocument(ctx.companyId, id);

    const upiUri = doc.print.showUpiQr ? upiPaymentUri(doc) : null;
    const qrDataUrl = upiUri
      ? await QRCode.toDataURL(upiUri, { margin: 0, width: 240 }).catch(() => null)
      : null;

    const buffer = await renderToBuffer(
      InvoicePdf({ doc, theme, copyLabel, qrDataUrl }),
    );

    const fileName = `${doc.typeLabel.replace(/\s+/g, "-")}-${doc.displayNumber}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[pdf] render failed:", error);
    return NextResponse.json({ error: "Could not generate the PDF" }, { status: 500 });
  }
}

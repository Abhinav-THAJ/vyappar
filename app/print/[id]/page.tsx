import type { Metadata } from "next";
import QRCode from "qrcode";
import { requireCompany } from "@/lib/auth/session";
import {
  getInvoiceDocument,
  upiPaymentUri,
  whatsappShareUrl,
} from "@/server/services/document";
import { PrintView } from "./print-view";

export const metadata: Metadata = { title: "Print" };

const LIST_PATHS: Record<string, string> = {
  SALE: "/sale/invoices",
  SALE_RETURN: "/sale/credit-notes",
  ESTIMATE: "/sale/estimates",
  PROFORMA: "/sale/proforma",
  SALE_ORDER: "/sale/orders",
  DELIVERY_CHALLAN: "/sale/challans",
  PAYMENT_IN: "/sale/payments-in",
  PURCHASE: "/purchase/bills",
  PURCHASE_RETURN: "/purchase/debit-notes",
  PURCHASE_ORDER: "/purchase/orders",
  PAYMENT_OUT: "/purchase/payments-out",
  EXPENSE: "/expenses",
};

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ share?: string }>;
}) {
  const { id } = await params;
  const { share } = await searchParams;
  const ctx = await requireCompany();

  const doc = await getInvoiceDocument(ctx.companyId, id);

  const upiUri = upiPaymentUri(doc);
  const qrDataUrl = upiUri
    ? await QRCode.toDataURL(upiUri, { margin: 0, width: 240 }).catch(() => null)
    : null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <PrintView
      doc={doc}
      qrDataUrl={qrDataUrl}
      whatsappUrl={whatsappShareUrl(doc, appUrl)}
      backHref={LIST_PATHS[doc.type] ?? "/dashboard"}
      autoShare={share === "1"}
    />
  );
}

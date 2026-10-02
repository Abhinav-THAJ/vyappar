import * as React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { formatCurrency, formatQty } from "@/lib/format/number";
import { amountInWords } from "@/lib/format/words";
import { formatDate } from "@/lib/format/date";
import type { InvoiceDocument } from "@/server/services/document";

/**
 * Server-side PDF, carrying the same block list as the HTML themes so a
 * downloaded invoice and a printed one agree.
 *
 * Deliberately built from @react-pdf primitives rather than by rasterising the
 * HTML: the output is real vector text, so it stays searchable and small.
 */

const ACCENTS: Record<string, string> = {
  classic: "#1f2937",
  modern: "#14675e",
  compact: "#1f2937",
};

function makeStyles(accent: string) {
  return StyleSheet.create({
    page: { padding: 28, fontSize: 8.5, color: "#111827", fontFamily: "Helvetica" },
    row: { flexDirection: "row" },
    between: { flexDirection: "row", justifyContent: "space-between" },

    title: { fontSize: 13, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
    docType: {
      fontSize: 11,
      fontFamily: "Helvetica-Bold",
      textTransform: "uppercase",
      color: accent,
    },
    muted: { color: "#6b7280" },
    bold: { fontFamily: "Helvetica-Bold" },

    headerRule: { borderBottomWidth: 2, borderBottomColor: accent, paddingBottom: 8 },

    box: { borderWidth: 1, borderColor: "#d1d5db", padding: 6 },

    table: { borderWidth: 1, borderColor: "#d1d5db" },
    th: {
      flexDirection: "row",
      backgroundColor: "#f3f4f6",
      borderBottomWidth: 1,
      borderBottomColor: "#d1d5db",
    },
    tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
    cell: { padding: 4 },

    logo: { width: 44, height: 44, objectFit: "contain", marginRight: 10 },
    logoFallback: {
      width: 44,
      height: 44,
      marginRight: 10,
      backgroundColor: accent,
      color: "#fff",
      fontSize: 14,
      fontFamily: "Helvetica-Bold",
      textAlign: "center",
      paddingTop: 13,
    },

    footerNote: { marginTop: 10, fontSize: 7.5, color: "#9ca3af", textAlign: "center" },
  });
}

export function InvoicePdf({
  doc,
  theme = "classic",
  copyLabel,
  qrDataUrl,
}: {
  doc: InvoiceDocument;
  theme?: string;
  copyLabel?: string;
  qrDataUrl?: string | null;
}) {
  const accent = ACCENTS[theme] ?? ACCENTS.classic!;
  const s = makeStyles(accent);
  const showDiscount = doc.lines.some((l) => Number(l.discount) > 0);

  // Column widths, rebalanced when GST or discount columns are hidden.
  const w = {
    idx: 18,
    name: doc.gstEnabled ? (showDiscount ? 140 : 170) : showDiscount ? 190 : 220,
    hsn: doc.gstEnabled ? 45 : 0,
    qty: 34,
    unit: 30,
    rate: 52,
    discount: showDiscount ? 45 : 0,
    tax: doc.gstEnabled ? 52 : 0,
    amount: 58,
  };

  return (
    <Document
      title={`${doc.typeLabel} ${doc.displayNumber}`}
      author={doc.firm.name}
      subject={`${doc.typeLabel} for ${doc.party?.name ?? "Cash sale"}`}
    >
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={[s.between, s.headerRule]}>
          <View style={[s.row, { flex: 1 }]}>
            {doc.print.showLogo ? (
              doc.firm.logoUrl ? (
                <Image src={doc.firm.logoUrl} style={s.logo} />
              ) : (
                <Text style={s.logoFallback}>{initials(doc.firm.name)}</Text>
              )
            ) : null}

            <View style={{ flex: 1 }}>
              <Text style={s.title}>{doc.firm.name}</Text>
              {doc.firm.address ? (
                <Text style={[s.muted, { marginTop: 2 }]}>{doc.firm.address}</Text>
              ) : null}
              <Text style={[s.muted, { marginTop: 2 }]}>
                {[
                  doc.firm.phone ? `Phone: ${doc.firm.phone}` : null,
                  doc.firm.email ? `Email: ${doc.firm.email}` : null,
                ]
                  .filter(Boolean)
                  .join("   ")}
              </Text>
              {doc.gstEnabled ? (
                <Text style={{ marginTop: 2 }}>
                  {[
                    doc.firm.gstin ? `GSTIN: ${doc.firm.gstin}` : null,
                    `State: ${doc.firm.stateName}`,
                  ]
                    .filter(Boolean)
                    .join("   ")}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.docType}>{doc.gstEnabled ? "Tax Invoice" : doc.typeLabel}</Text>
            <Text style={[s.bold, { marginTop: 3 }]}>{doc.displayNumber}</Text>
            <Text style={s.muted}>{formatDate(doc.date)}</Text>
            {copyLabel ? (
              <Text style={[s.muted, { marginTop: 2, fontSize: 7 }]}>{copyLabel}</Text>
            ) : null}
          </View>
        </View>

        {/* Party */}
        <View style={[s.row, { marginTop: 10, borderWidth: 1, borderColor: "#d1d5db" }]}>
          <View style={[s.cell, { flex: 1, borderRightWidth: 1, borderRightColor: "#d1d5db" }]}>
            <Text style={[s.muted, s.bold, { fontSize: 7, textTransform: "uppercase" }]}>
              Bill To
            </Text>
            <Text style={[s.bold, { marginTop: 2 }]}>{doc.party?.name ?? "Cash sale"}</Text>
            {doc.party?.billingAddress ? (
              <Text style={s.muted}>{doc.party.billingAddress}</Text>
            ) : null}
            {doc.party?.phone ? <Text style={s.muted}>Contact: {doc.party.phone}</Text> : null}
            {doc.gstEnabled && doc.party?.gstin ? (
              <Text>GSTIN: {doc.party.gstin}</Text>
            ) : null}
          </View>

          <View style={[s.cell, { flex: 1 }]}>
            <Text style={[s.muted, s.bold, { fontSize: 7, textTransform: "uppercase" }]}>
              Invoice Details
            </Text>
            <Text style={{ marginTop: 2 }}>No: {doc.displayNumber}</Text>
            <Text>Date: {formatDate(doc.date)}</Text>
            {doc.dueDate ? <Text>Due: {formatDate(doc.dueDate)}</Text> : null}
            {doc.party?.stateName ? (
              <Text style={s.muted}>Place of supply: {doc.party.stateName}</Text>
            ) : null}
          </View>
        </View>

        {/* Lines */}
        <View style={[s.table, { marginTop: 8 }]}>
          <View style={s.th}>
            <Cell w={w.idx} bold>
              #
            </Cell>
            <Cell w={w.name} bold>
              Item name
            </Cell>
            {doc.gstEnabled ? (
              <Cell w={w.hsn} bold>
                HSN/SAC
              </Cell>
            ) : null}
            <Cell w={w.qty} bold align="right">
              Qty
            </Cell>
            <Cell w={w.unit} bold>
              Unit
            </Cell>
            <Cell w={w.rate} bold align="right">
              Price
            </Cell>
            {showDiscount ? (
              <Cell w={w.discount} bold align="right">
                Disc.
              </Cell>
            ) : null}
            {doc.gstEnabled ? (
              <Cell w={w.tax} bold align="right">
                GST
              </Cell>
            ) : null}
            <Cell w={w.amount} bold align="right" last>
              Amount
            </Cell>
          </View>

          {doc.lines.map((line) => (
            <View key={line.index} style={s.tr} wrap={false}>
              <Cell w={w.idx}>{String(line.index)}</Cell>
              <Cell w={w.name}>{line.name}</Cell>
              {doc.gstEnabled ? <Cell w={w.hsn}>{line.hsnSac ?? "-"}</Cell> : null}
              <Cell w={w.qty} align="right">
                {formatQty(line.qty)}
              </Cell>
              <Cell w={w.unit}>{line.unit ?? "-"}</Cell>
              <Cell w={w.rate} align="right">
                {formatCurrency(line.rate)}
              </Cell>
              {showDiscount ? (
                <Cell w={w.discount} align="right">
                  {Number(line.discount) > 0 ? formatCurrency(line.discount) : "-"}
                </Cell>
              ) : null}
              {doc.gstEnabled ? (
                <Cell w={w.tax} align="right">
                  {formatCurrency(line.taxAmount)}
                </Cell>
              ) : null}
              <Cell w={w.amount} align="right" last>
                {formatCurrency(line.amount)}
              </Cell>
            </View>
          ))}
        </View>

        {/* Tax summary + totals */}
        <View style={[s.row, { marginTop: 8 }]}>
          <View style={{ flex: 1, marginRight: 8 }}>
            {doc.gstEnabled && doc.taxRows.length > 0 ? (
              <View style={s.table}>
                <View style={s.th}>
                  <Cell w={50} bold>
                    HSN
                  </Cell>
                  <Cell w={60} bold align="right">
                    Taxable
                  </Cell>
                  <Cell w={55} bold align="right">
                    {doc.isIgst ? "IGST" : "CGST"}
                  </Cell>
                  {!doc.isIgst ? (
                    <Cell w={55} bold align="right" last>
                      SGST
                    </Cell>
                  ) : (
                    <Cell w={55} bold align="right" last>
                      Total
                    </Cell>
                  )}
                </View>
                {doc.taxRows.map((r, i) => (
                  <View key={i} style={s.tr}>
                    <Cell w={50}>{r.hsnSac}</Cell>
                    <Cell w={60} align="right">
                      {formatCurrency(r.taxableValue)}
                    </Cell>
                    <Cell w={55} align="right">
                      {formatCurrency(doc.isIgst ? r.igst : r.cgst)}
                    </Cell>
                    <Cell w={55} align="right" last>
                      {formatCurrency(doc.isIgst ? r.total : r.sgst)}
                    </Cell>
                  </View>
                ))}
              </View>
            ) : null}

            {doc.print.showAmountInWords ? (
              <View style={[s.box, { marginTop: 8 }]}>
                <Text style={[s.muted, s.bold, { fontSize: 7, textTransform: "uppercase" }]}>
                  Invoice Amount in Words
                </Text>
                <Text style={{ marginTop: 2 }}>{amountInWords(doc.total)}</Text>
              </View>
            ) : null}

            {doc.print.showBankDetails && doc.firm.bankAccountNo ? (
              <View style={[s.box, { marginTop: 6 }]}>
                <Text style={[s.muted, s.bold, { fontSize: 7, textTransform: "uppercase" }]}>
                  Bank Details
                </Text>
                {doc.firm.bankName ? <Text>{doc.firm.bankName}</Text> : null}
                <Text>A/c: {doc.firm.bankAccountNo}</Text>
                {doc.firm.bankIfsc ? <Text>IFSC: {doc.firm.bankIfsc}</Text> : null}
                {doc.firm.upiId ? <Text>UPI: {doc.firm.upiId}</Text> : null}
              </View>
            ) : null}
          </View>

          <View style={{ width: 190 }}>
            <View style={s.box}>
              <TotalRow label="Sub Total" value={formatCurrency(doc.subTotal)} />
              {Number(doc.discountAmount) > 0 ? (
                <TotalRow label="Discount" value={`- ${formatCurrency(doc.discountAmount)}`} />
              ) : null}
              {doc.additionalCharges.map((c) => (
                <TotalRow key={c.name} label={c.name} value={formatCurrency(c.amount)} />
              ))}
              {doc.gstEnabled && Number(doc.cgst) > 0 ? (
                <>
                  <TotalRow label="CGST" value={formatCurrency(doc.cgst)} />
                  <TotalRow label="SGST" value={formatCurrency(doc.sgst)} />
                </>
              ) : null}
              {doc.gstEnabled && Number(doc.igst) > 0 ? (
                <TotalRow label="IGST" value={formatCurrency(doc.igst)} />
              ) : null}
              {Number(doc.cess) > 0 ? (
                <TotalRow label="Cess" value={formatCurrency(doc.cess)} />
              ) : null}
              {Number(doc.tcs) > 0 ? (
                <TotalRow label="TCS" value={formatCurrency(doc.tcs)} />
              ) : null}
              {Number(doc.roundOff) !== 0 ? (
                <TotalRow label="Round off" value={formatCurrency(doc.roundOff)} />
              ) : null}

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  borderTopWidth: 1,
                  borderTopColor: "#d1d5db",
                  paddingTop: 3,
                  marginTop: 3,
                }}
              >
                <Text style={[s.bold, { fontSize: 10 }]}>Total</Text>
                <Text style={[s.bold, { fontSize: 10 }]}>{formatCurrency(doc.total)}</Text>
              </View>

              <TotalRow label="Received" value={formatCurrency(doc.paidAmount)} />
              <TotalRow label="Balance" value={formatCurrency(doc.balanceAmount)} bold />
            </View>

            {doc.print.showUpiQr && qrDataUrl ? (
              <View style={{ alignItems: "center", marginTop: 8 }}>
                <Image src={qrDataUrl} style={{ width: 72, height: 72 }} />
                <Text style={[s.muted, { fontSize: 7, marginTop: 2 }]}>Scan to pay</Text>
              </View>
            ) : null}

            <View style={[s.box, { marginTop: 8, alignItems: "flex-end" }]}>
              <Text style={s.bold}>For {doc.firm.name}</Text>
              {doc.print.showSignature && doc.firm.signatureUrl ? (
                <Image src={doc.firm.signatureUrl} style={{ height: 30, marginTop: 4 }} />
              ) : (
                <View style={{ height: 30 }} />
              )}
              <Text style={[s.muted, { marginTop: 3 }]}>Authorised Signatory</Text>
            </View>
          </View>
        </View>

        {doc.print.showTerms && doc.terms ? (
          <View style={[s.box, { marginTop: 8 }]}>
            <Text style={[s.muted, s.bold, { fontSize: 7, textTransform: "uppercase" }]}>
              Terms &amp; Conditions
            </Text>
            <Text style={{ marginTop: 2 }}>{doc.terms}</Text>
          </View>
        ) : null}

        <Text
          style={s.footerNote}
          render={({ pageNumber, totalPages }) =>
            totalPages > 1 ? `Page ${pageNumber} of ${totalPages}` : ""
          }
          fixed
        />
      </Page>
    </Document>
  );
}

function Cell({
  children,
  w,
  bold,
  align = "left",
  last,
}: {
  children?: React.ReactNode;
  w: number;
  bold?: boolean;
  align?: "left" | "right";
  last?: boolean;
}) {
  if (w === 0) return null;
  return (
    <Text
      style={{
        width: w,
        padding: 4,
        textAlign: align,
        fontFamily: bold ? "Helvetica-Bold" : "Helvetica",
        borderRightWidth: last ? 0 : 1,
        borderRightColor: "#e5e7eb",
      }}
    >
      {children}
    </Text>
  );
}

function TotalRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 1.5 }}>
      <Text style={{ color: bold ? "#111827" : "#6b7280", fontFamily: bold ? "Helvetica-Bold" : "Helvetica" }}>
        {label}
      </Text>
      <Text style={{ fontFamily: bold ? "Helvetica-Bold" : "Helvetica" }}>{value}</Text>
    </View>
  );
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

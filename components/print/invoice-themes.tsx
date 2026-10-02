import * as React from "react";
import { formatCurrency, formatQty } from "@/lib/format/number";
import { amountInWords } from "@/lib/format/words";
import { formatDate } from "@/lib/format/date";
import { initials, cn } from "@/lib/utils";
import type { InvoiceDocument } from "@/server/services/document";

export type ThemeName = "classic" | "modern" | "compact";

export interface ThemeProps {
  doc: InvoiceDocument;
  copyLabel?: string;
  qrDataUrl?: string | null;
}

/* -------------------------------------------------------------------------- */
/* Shared blocks                                                               */
/* -------------------------------------------------------------------------- */

function FirmHeader({ doc, accent }: { doc: InvoiceDocument; accent: string }) {
  return (
    <div className="flex items-start gap-4">
      {doc.print.showLogo ? (
        doc.firm.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={doc.firm.logoUrl}
            alt=""
            className="size-16 shrink-0 rounded object-contain"
          />
        ) : (
          <div
            className={cn(
              "grid size-16 shrink-0 place-items-center rounded text-lg font-bold text-white",
              accent,
            )}
          >
            {initials(doc.firm.name)}
          </div>
        )
      ) : null}

      <div className="min-w-0 flex-1">
        <h1 className="text-[17px] font-bold uppercase leading-tight">{doc.firm.name}</h1>
        {doc.firm.address ? (
          <p className="mt-0.5 text-[10px] leading-snug text-gray-600">{doc.firm.address}</p>
        ) : null}
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-gray-600">
          {doc.firm.phone ? <span>Phone: {doc.firm.phone}</span> : null}
          {doc.firm.email ? <span>Email: {doc.firm.email}</span> : null}
        </div>
        {doc.gstEnabled ? (
          <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px]">
            {doc.firm.gstin ? <span className="font-semibold">GSTIN: {doc.firm.gstin}</span> : null}
            <span>State: {doc.firm.stateName}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PartyBlock({ doc }: { doc: InvoiceDocument }) {
  return (
    <div className="grid grid-cols-2 border border-gray-300 text-[10px]">
      <div className="border-r border-gray-300 p-2.5">
        <div className="mb-1 font-semibold uppercase text-gray-500">Bill To</div>
        <div className="text-[11px] font-semibold">{doc.party?.name ?? "Cash sale"}</div>
        {doc.party?.billingAddress ? (
          <div className="mt-0.5 whitespace-pre-line text-gray-600">
            {doc.party.billingAddress}
          </div>
        ) : null}
        {doc.party?.phone ? (
          <div className="mt-0.5 text-gray-600">Contact No.: {doc.party.phone}</div>
        ) : null}
        {doc.gstEnabled && doc.party?.gstin ? (
          <div className="mt-0.5 font-medium">GSTIN: {doc.party.gstin}</div>
        ) : null}
        {doc.party?.stateName ? (
          <div className="text-gray-600">State: {doc.party.stateName}</div>
        ) : null}
      </div>

      <div className="p-2.5">
        <div className="mb-1 font-semibold uppercase text-gray-500">Invoice Details</div>
        <Pair label="No" value={doc.displayNumber} />
        <Pair label="Date" value={formatDate(doc.date)} />
        {doc.dueDate ? <Pair label="Due date" value={formatDate(doc.dueDate)} /> : null}
        {doc.party?.shippingAddress && doc.party.shippingAddress !== doc.party.billingAddress ? (
          <div className="mt-1.5">
            <div className="font-semibold uppercase text-gray-500">Ship To</div>
            <div className="whitespace-pre-line text-gray-600">{doc.party.shippingAddress}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1">
      <span className="text-gray-600">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function LineTable({ doc, headerClass }: { doc: InvoiceDocument; headerClass: string }) {
  const showDiscount = doc.lines.some((l) => Number(l.discount) > 0);

  return (
    <table className="w-full border-collapse border border-gray-300 text-[10px]">
      <thead>
        <tr className={cn("text-left", headerClass)}>
          <Th className="w-7">#</Th>
          <Th>Item name</Th>
          {doc.gstEnabled ? <Th className="w-16">HSN/SAC</Th> : null}
          <Th className="w-12" align="right">
            Qty
          </Th>
          <Th className="w-12">Unit</Th>
          <Th className="w-20" align="right">
            Price/Unit
          </Th>
          {showDiscount ? (
            <Th className="w-16" align="right">
              Discount
            </Th>
          ) : null}
          {doc.gstEnabled ? (
            <Th className="w-16" align="right">
              GST
            </Th>
          ) : null}
          <Th className="w-20" align="right">
            Amount
          </Th>
        </tr>
      </thead>

      <tbody>
        {doc.lines.map((line) => (
          <tr key={line.index} className="break-inside-avoid">
            <Td>{line.index}</Td>
            <Td>
              <div className="font-medium">{line.name}</div>
              {line.description ? (
                <div className="text-gray-500">{line.description}</div>
              ) : null}
              {Number(line.freeQty) > 0 ? (
                <div className="text-gray-500">Free: {formatQty(line.freeQty)}</div>
              ) : null}
            </Td>
            {doc.gstEnabled ? <Td>{line.hsnSac ?? "—"}</Td> : null}
            <Td align="right">{formatQty(line.qty)}</Td>
            <Td>{line.unit ?? "—"}</Td>
            <Td align="right">{formatCurrency(line.rate)}</Td>
            {showDiscount ? (
              <Td align="right">{Number(line.discount) > 0 ? formatCurrency(line.discount) : "—"}</Td>
            ) : null}
            {doc.gstEnabled ? (
              <Td align="right">
                {formatCurrency(line.taxAmount)}
                <div className="text-gray-500">({line.taxRate}%)</div>
              </Td>
            ) : null}
            <Td align="right" className="font-medium">
              {formatCurrency(line.amount)}
            </Td>
          </tr>
        ))}
      </tbody>

      <tfoot>
        <tr className={cn("font-semibold", headerClass)}>
          <Td colSpan={doc.gstEnabled ? 3 : 2}>Total</Td>
          <Td align="right">
            {formatQty(
              doc.lines.reduce((acc, l) => acc + Number(l.qty), 0).toString(),
            )}
          </Td>
          <Td colSpan={showDiscount ? 3 : 2} />
          {doc.gstEnabled ? (
            <Td align="right">
              {formatCurrency(
                doc.lines.reduce((acc, l) => acc + Number(l.taxAmount), 0).toFixed(2),
              )}
            </Td>
          ) : null}
          <Td align="right">{formatCurrency(doc.total)}</Td>
        </tr>
      </tfoot>
    </table>
  );
}

function TaxSummary({ doc, headerClass }: { doc: InvoiceDocument; headerClass: string }) {
  if (!doc.gstEnabled || doc.taxRows.length === 0) return null;

  return (
    <table className="w-full border-collapse border border-gray-300 text-[10px]">
      <thead>
        <tr className={headerClass}>
          <Th>HSN/SAC</Th>
          <Th align="right">Taxable amount</Th>
          {doc.isIgst ? (
            <>
              <Th align="right">IGST rate</Th>
              <Th align="right">IGST amount</Th>
            </>
          ) : (
            <>
              <Th align="right">CGST rate</Th>
              <Th align="right">CGST amt</Th>
              <Th align="right">SGST rate</Th>
              <Th align="right">SGST amt</Th>
            </>
          )}
          <Th align="right">Total tax</Th>
        </tr>
      </thead>
      <tbody>
        {doc.taxRows.map((row, i) => (
          <tr key={i}>
            <Td>{row.hsnSac}</Td>
            <Td align="right">{formatCurrency(row.taxableValue)}</Td>
            {doc.isIgst ? (
              <>
                <Td align="right">{row.rate}%</Td>
                <Td align="right">{formatCurrency(row.igst)}</Td>
              </>
            ) : (
              <>
                <Td align="right">{(Number(row.rate) / 2).toFixed(2)}%</Td>
                <Td align="right">{formatCurrency(row.cgst)}</Td>
                <Td align="right">{(Number(row.rate) / 2).toFixed(2)}%</Td>
                <Td align="right">{formatCurrency(row.sgst)}</Td>
              </>
            )}
            <Td align="right" className="font-medium">
              {formatCurrency(row.total)}
            </Td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className={cn("font-semibold", headerClass)}>
          <Td>TOTAL</Td>
          <Td align="right">{formatCurrency(doc.taxableValue)}</Td>
          {doc.isIgst ? (
            <>
              <Td />
              <Td align="right">{formatCurrency(doc.igst)}</Td>
            </>
          ) : (
            <>
              <Td />
              <Td align="right">{formatCurrency(doc.cgst)}</Td>
              <Td />
              <Td align="right">{formatCurrency(doc.sgst)}</Td>
            </>
          )}
          <Td align="right">
            {formatCurrency(
              (Number(doc.cgst) + Number(doc.sgst) + Number(doc.igst) + Number(doc.cess)).toFixed(2),
            )}
          </Td>
        </tr>
      </tfoot>
    </table>
  );
}

function Totals({ doc }: { doc: InvoiceDocument }) {
  return (
    <div className="space-y-1 text-[10px]">
      <TotalRow label="Sub Total" value={formatCurrency(doc.subTotal)} />
      {Number(doc.discountAmount) > 0 ? (
        <TotalRow label="Discount" value={`− ${formatCurrency(doc.discountAmount)}`} />
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
      {Number(doc.cess) > 0 ? <TotalRow label="Cess" value={formatCurrency(doc.cess)} /> : null}
      {Number(doc.tcs) > 0 ? <TotalRow label="TCS" value={formatCurrency(doc.tcs)} /> : null}
      {Number(doc.roundOff) !== 0 ? (
        <TotalRow label="Round off" value={formatCurrency(doc.roundOff)} />
      ) : null}

      <div className="flex items-center justify-between border-t border-gray-300 pt-1 text-[12px] font-bold">
        <span>Total</span>
        <span>{formatCurrency(doc.total)}</span>
      </div>

      <TotalRow label="Received" value={formatCurrency(doc.paidAmount)} />
      <div className="flex items-center justify-between font-semibold">
        <span>Balance</span>
        <span>{formatCurrency(doc.balanceAmount)}</span>
      </div>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Footer({ doc, qrDataUrl }: { doc: InvoiceDocument; qrDataUrl?: string | null }) {
  return (
    <div className="grid grid-cols-2 gap-3 text-[10px]">
      <div className="space-y-2">
        {doc.print.showAmountInWords ? (
          <div className="border border-gray-300 p-2">
            <div className="font-semibold uppercase text-gray-500">Invoice Amount in Words</div>
            <div className="mt-0.5 font-medium">{amountInWords(doc.total)}</div>
          </div>
        ) : null}

        {doc.print.showBankDetails && doc.firm.bankAccountNo ? (
          <div className="border border-gray-300 p-2">
            <div className="font-semibold uppercase text-gray-500">Bank Details</div>
            <div className="mt-0.5 space-y-0.5 text-gray-700">
              {doc.firm.bankName ? <div>{doc.firm.bankName}</div> : null}
              <div>A/c: {doc.firm.bankAccountNo}</div>
              {doc.firm.bankIfsc ? <div>IFSC: {doc.firm.bankIfsc}</div> : null}
              {doc.firm.upiId ? <div>UPI: {doc.firm.upiId}</div> : null}
            </div>
          </div>
        ) : null}

        {doc.print.showTerms && doc.terms ? (
          <div className="border border-gray-300 p-2">
            <div className="font-semibold uppercase text-gray-500">Terms &amp; Conditions</div>
            <div className="mt-0.5 whitespace-pre-line text-gray-700">{doc.terms}</div>
          </div>
        ) : null}

        {doc.notes ? (
          <div className="border border-gray-300 p-2">
            <div className="font-semibold uppercase text-gray-500">Notes</div>
            <div className="mt-0.5 whitespace-pre-line text-gray-700">{doc.notes}</div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col items-end justify-between gap-3">
        {doc.print.showUpiQr && qrDataUrl ? (
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="UPI payment QR code" className="size-24" />
            <div className="mt-1 text-[9px] text-gray-500">Scan to pay</div>
          </div>
        ) : (
          <span />
        )}

        <div className="w-full border border-gray-300 p-2 text-right">
          <div className="font-medium">For {doc.firm.name}</div>
          {doc.print.showSignature && doc.firm.signatureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={doc.firm.signatureUrl}
              alt=""
              className="ml-auto mt-1 h-10 object-contain"
            />
          ) : (
            <div className="h-10" />
          )}
          <div className="mt-1 border-t border-gray-300 pt-1 text-gray-500">
            Authorised Signatory
          </div>
        </div>
      </div>
    </div>
  );
}

function Th({
  children,
  className,
  align = "left",
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <th
      className={cn(
        "border border-gray-300 px-1.5 py-1 font-semibold",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
  align = "left",
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right";
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "border border-gray-300 px-1.5 py-1 align-top",
        align === "right" && "text-right tabular-nums",
        className,
      )}
    >
      {children}
    </td>
  );
}

/* -------------------------------------------------------------------------- */
/* Themes                                                                      */
/* -------------------------------------------------------------------------- */

/** Classic: bordered, dense, closest to a traditional Indian tax invoice. */
export function ClassicTheme({ doc, copyLabel, qrDataUrl }: ThemeProps) {
  return (
    <article className="mx-auto w-[210mm] max-w-full bg-white p-[10mm] text-black">
      <div className="border-2 border-gray-800 p-3">
        <div className="mb-2 text-center">
          <div className="text-[11px] font-bold uppercase tracking-widest">
            {doc.gstEnabled ? "Tax Invoice" : doc.typeLabel}
          </div>
          {copyLabel ? (
            <div className="text-[9px] uppercase text-gray-500">({copyLabel})</div>
          ) : null}
        </div>

        <FirmHeader doc={doc} accent="bg-gray-800" />

        <div className="mt-3">
          <PartyBlock doc={doc} />
        </div>

        <div className="mt-2">
          <LineTable doc={doc} headerClass="bg-gray-100" />
        </div>

        {/* The tax summary gets the full width: with CGST and SGST it carries
            seven columns, which overflow and collide with the totals if the two
            are placed side by side. */}
        <div className="mt-2">
          <TaxSummary doc={doc} headerClass="bg-gray-100" />
        </div>

        <div className="mt-2 flex justify-end">
          <div className="w-64 border border-gray-300 p-2">
            <Totals doc={doc} />
          </div>
        </div>

        <div className="mt-2">
          <Footer doc={doc} qrDataUrl={qrDataUrl} />
        </div>
      </div>
    </article>
  );
}

/** Modern: airier, an accent rule, no outer box. */
export function ModernTheme({ doc, copyLabel, qrDataUrl }: ThemeProps) {
  return (
    <article className="mx-auto w-[210mm] max-w-full bg-white p-[12mm] text-black">
      <div className="flex items-start justify-between gap-6 border-b-[3px] border-teal-700 pb-4">
        <FirmHeader doc={doc} accent="bg-teal-700" />
        <div className="shrink-0 text-right">
          <div className="text-[18px] font-bold uppercase tracking-wide text-teal-800">
            {doc.gstEnabled ? "Tax Invoice" : doc.typeLabel}
          </div>
          <div className="mt-1 text-[11px] font-semibold">{doc.displayNumber}</div>
          <div className="text-[10px] text-gray-600">{formatDate(doc.date)}</div>
          {copyLabel ? (
            <div className="mt-1 text-[9px] uppercase text-gray-400">{copyLabel}</div>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <PartyBlock doc={doc} />
      </div>

      <div className="mt-3">
        <LineTable doc={doc} headerClass="bg-teal-50" />
      </div>

      <div className="mt-3">
        <TaxSummary doc={doc} headerClass="bg-teal-50" />
      </div>

      <div className="mt-3 flex justify-end">
        <div className="w-64 rounded border border-gray-300 p-2.5">
          <Totals doc={doc} />
        </div>
      </div>

      <div className="mt-4">
        <Footer doc={doc} qrDataUrl={qrDataUrl} />
      </div>
    </article>
  );
}

/** Compact: fits long invoices on one page. */
export function CompactTheme({ doc, copyLabel, qrDataUrl }: ThemeProps) {
  return (
    <article className="mx-auto w-[210mm] max-w-full bg-white p-[8mm] text-[9px] text-black">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[14px] font-bold uppercase">{doc.firm.name}</h1>
          <p className="text-[9px] text-gray-600">{doc.firm.address}</p>
          <p className="text-[9px] text-gray-600">
            {[doc.firm.phone, doc.firm.gstin ? `GSTIN ${doc.firm.gstin}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-bold uppercase">
            {doc.gstEnabled ? "Tax Invoice" : doc.typeLabel}
          </div>
          <div className="font-semibold">{doc.displayNumber}</div>
          <div className="text-gray-600">{formatDate(doc.date)}</div>
          {copyLabel ? <div className="text-gray-400">{copyLabel}</div> : null}
        </div>
      </div>

      <div className="mt-2 border-y border-gray-300 py-1.5">
        <span className="font-semibold">Bill To: </span>
        {doc.party?.name ?? "Cash sale"}
        {doc.party?.gstin ? <span className="text-gray-600"> · GSTIN {doc.party.gstin}</span> : null}
        {doc.party?.phone ? <span className="text-gray-600"> · {doc.party.phone}</span> : null}
      </div>

      <div className="mt-2">
        <LineTable doc={doc} headerClass="bg-gray-100" />
      </div>

      <div className="mt-2 flex justify-end">
        <div className="w-64 border border-gray-300 p-2">
          <Totals doc={doc} />
        </div>
      </div>

      <div className="mt-2">
        <TaxSummary doc={doc} headerClass="bg-gray-100" />
      </div>

      <div className="mt-2">
        <Footer doc={doc} qrDataUrl={qrDataUrl} />
      </div>
    </article>
  );
}

/** Thermal receipt for an 80mm or 58mm roll printer. */
export function ThermalTheme({
  doc,
  width = 80,
}: {
  doc: InvoiceDocument;
  width?: 80 | 58;
}) {
  return (
    <article
      className="mx-auto bg-white p-2 font-mono text-[10px] leading-snug text-black"
      style={{ width: width === 80 ? "80mm" : "58mm" }}
    >
      <div className="text-center">
        <div className="text-[12px] font-bold uppercase">{doc.firm.name}</div>
        {doc.firm.address ? <div className="text-[9px]">{doc.firm.address}</div> : null}
        {doc.firm.phone ? <div className="text-[9px]">Ph: {doc.firm.phone}</div> : null}
        {doc.gstEnabled && doc.firm.gstin ? (
          <div className="text-[9px]">GSTIN: {doc.firm.gstin}</div>
        ) : null}
      </div>

      <Divider />

      <div className="flex justify-between">
        <span>{doc.displayNumber}</span>
        <span>{formatDate(doc.date)}</span>
      </div>
      {doc.party ? <div className="truncate">To: {doc.party.name}</div> : null}

      <Divider />

      {doc.lines.map((line) => (
        <div key={line.index} className="mb-1">
          <div className="truncate">{line.name}</div>
          <div className="flex justify-between">
            <span>
              {formatQty(line.qty)} {line.unit ?? ""} x {formatCurrency(line.rate)}
            </span>
            <span>{formatCurrency(line.amount)}</span>
          </div>
        </div>
      ))}

      <Divider />

      <Line label="Sub total" value={formatCurrency(doc.subTotal)} />
      {Number(doc.discountAmount) > 0 ? (
        <Line label="Discount" value={`-${formatCurrency(doc.discountAmount)}`} />
      ) : null}
      {doc.gstEnabled && Number(doc.cgst) > 0 ? (
        <>
          <Line label="CGST" value={formatCurrency(doc.cgst)} />
          <Line label="SGST" value={formatCurrency(doc.sgst)} />
        </>
      ) : null}
      {doc.gstEnabled && Number(doc.igst) > 0 ? (
        <Line label="IGST" value={formatCurrency(doc.igst)} />
      ) : null}
      {Number(doc.roundOff) !== 0 ? (
        <Line label="Round off" value={formatCurrency(doc.roundOff)} />
      ) : null}

      <Divider />

      <div className="flex justify-between text-[12px] font-bold">
        <span>TOTAL</span>
        <span>{formatCurrency(doc.total)}</span>
      </div>
      <Line label="Received" value={formatCurrency(doc.paidAmount)} />
      <Line label="Balance" value={formatCurrency(doc.balanceAmount)} />

      <Divider />

      <div className="text-center text-[9px]">
        {doc.terms ? <div className="mb-1">{doc.terms}</div> : null}
        <div>Thank you!</div>
      </div>
    </article>
  );
}

function Divider() {
  return <div className="my-1 border-t border-dashed border-black" />;
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export const THEMES: Record<ThemeName, React.ComponentType<ThemeProps>> = {
  classic: ClassicTheme,
  modern: ModernTheme,
  compact: CompactTheme,
};

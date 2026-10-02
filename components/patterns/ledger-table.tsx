import * as React from "react";
import { Table, THead, TBody, TR, TH, TD, TRMessage } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Money } from "@/components/ui/display";
import { formatCurrency } from "@/lib/format/number";
import { formatDate } from "@/lib/format/date";
import type { LedgerRow } from "@/server/services/cashbank";

/**
 * A running-balance statement. Used for cash, each bank account and the party
 * statement, so the three always present the same way.
 */
export function LedgerTable({
  rows,
  opening,
  closing,
  emptyTitle = "No entries in this period",
  emptyDescription,
  showParty = true,
}: {
  rows: LedgerRow[];
  opening: string;
  closing: string;
  emptyTitle?: string;
  emptyDescription?: string;
  showParty?: boolean;
}) {
  const columnCount = showParty ? 7 : 6;

  return (
    <div className="surface-card overflow-hidden">
      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Date</TH>
            <TH>Particulars</TH>
            <TH>Reference</TH>
            {showParty ? <TH>Party</TH> : null}
            <TH align="right">Debit</TH>
            <TH align="right">Credit</TH>
            <TH align="right">Balance</TH>
          </TR>
        </THead>

        <TBody>
          <TR className="bg-[var(--surface-2)] hover:bg-[var(--surface-2)]">
            <TD colSpan={columnCount - 1} className="font-medium">
              Opening balance
            </TD>
            <TD align="right" numeric className="font-medium">
              {formatCurrency(opening)}
            </TD>
          </TR>

          {rows.length === 0 ? (
            <TRMessage colSpan={columnCount}>
              <EmptyState compact title={emptyTitle} description={emptyDescription} />
            </TRMessage>
          ) : (
            rows.map((row) => (
              <TR key={row.id}>
                <TD className="whitespace-nowrap">{formatDate(row.date)}</TD>
                <TD>{row.narration}</TD>
                <TD className="whitespace-nowrap text-[var(--text-secondary)]">
                  {row.reference ?? "—"}
                </TD>
                {showParty ? (
                  <TD className="max-w-[180px]">
                    <span className="block truncate">{row.partyName ?? "—"}</span>
                  </TD>
                ) : null}
                <TD align="right" numeric>
                  {Number(row.debit) > 0 ? formatCurrency(row.debit) : "—"}
                </TD>
                <TD align="right" numeric>
                  {Number(row.credit) > 0 ? formatCurrency(row.credit) : "—"}
                </TD>
                <TD align="right" numeric className="font-medium">
                  {formatCurrency(row.balance)}
                </TD>
              </TR>
            ))
          )}

          <TR className="bg-[var(--surface-2)] font-semibold hover:bg-[var(--surface-2)]">
            <TD colSpan={columnCount - 1}>Closing balance</TD>
            <TD align="right" numeric>
              <Money value={Number(closing)}>{formatCurrency(closing)}</Money>
            </TD>
          </TR>
        </TBody>
      </Table>
    </div>
  );
}

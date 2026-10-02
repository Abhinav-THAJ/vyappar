"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TBody, TR, TH, TD, TRMessage } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { PageHeader } from "@/components/patterns/page-header";
import { formatCurrency } from "@/lib/format/number";
import { formatDate } from "@/lib/format/date";
import { updateChequeStatusAction } from "@/server/actions/cashbank";
import { CASH_BANK_SIBLINGS } from "../banks/banks-screen";
import { cn } from "@/lib/utils";

export interface ChequeRow {
  id: string;
  chequeNumber: string | null;
  amount: string;
  dueDate: string | null;
  status: "OPEN" | "DEPOSITED" | "WITHDRAWN" | "BOUNCED";
  closedOn: string | null;
  partyName: string | null;
  bankName: string | null;
  transactionId: string;
  displayNumber: string;
  transactionDate: string;
}

const STATUSES = ["all", "OPEN", "DEPOSITED", "WITHDRAWN", "BOUNCED"] as const;

const STATUS_LABELS: Record<string, string> = {
  all: "All",
  OPEN: "Open",
  DEPOSITED: "Deposited",
  WITHDRAWN: "Withdrawn",
  BOUNCED: "Bounced",
};

const STATUS_TONE: Record<string, "brand" | "positive" | "neutral" | "negative"> = {
  OPEN: "brand",
  DEPOSITED: "positive",
  WITHDRAWN: "neutral",
  BOUNCED: "negative",
};

/** The cheque register and its status machine. */
export function ChequesScreen({
  cheques,
  status,
  canWrite,
}: {
  cheques: ChequeRow[];
  status: string;
  canWrite: boolean;
}) {
  const router = useRouter();

  async function setStatus(cheque: ChequeRow, next: ChequeRow["status"]) {
    const result = await updateChequeStatusAction({ id: cheque.id, status: next });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Cheque marked ${STATUS_LABELS[next]?.toLowerCase()}`);
    router.refresh();
  }

  const openTotal = cheques
    .filter((c) => c.status === "OPEN")
    .reduce((acc, c) => acc + Number(c.amount), 0);

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="Cheques" siblings={CASH_BANK_SIBLINGS} />

      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 sm:px-6">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={s === "all" ? "/cash-bank/cheques" : `/cash-bank/cheques?status=${s}`}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              status === s
                ? "bg-brand-600 text-white"
                : "bg-[var(--surface-3)] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)]",
            )}
          >
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      <div className="p-4 sm:p-6">
        <div className="surface-card mb-4 p-5">
          <div className="text-[13px] text-[var(--text-secondary)]">Open cheques</div>
          <div className="tnum mt-1 text-2xl font-semibold">{formatCurrency(openTotal)}</div>
        </div>

        <div className="surface-card overflow-hidden">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Cheque no.</TH>
                <TH>Party</TH>
                <TH>Document</TH>
                <TH>Date</TH>
                <TH>Due</TH>
                <TH align="right">Amount</TH>
                <TH>Status</TH>
                {canWrite ? <TH align="right">Actions</TH> : null}
              </TR>
            </THead>
            <TBody>
              {cheques.length === 0 ? (
                <TRMessage colSpan={canWrite ? 8 : 7}>
                  <EmptyState
                    title="No cheques to show"
                    description="A cheque row appears automatically whenever a payment uses the Cheque mode."
                  />
                </TRMessage>
              ) : (
                cheques.map((cheque) => (
                  <TR key={cheque.id}>
                    <TD className="font-medium">{cheque.chequeNumber ?? "—"}</TD>
                    <TD>{cheque.partyName ?? "—"}</TD>
                    <TD>
                      <Link
                        href={`/print/${cheque.transactionId}`}
                        className="text-brand-600 hover:underline"
                      >
                        {cheque.displayNumber}
                      </Link>
                    </TD>
                    <TD className="whitespace-nowrap">{formatDate(cheque.transactionDate)}</TD>
                    <TD className="whitespace-nowrap">
                      {cheque.dueDate ? formatDate(cheque.dueDate) : "—"}
                    </TD>
                    <TD align="right" numeric>
                      {formatCurrency(cheque.amount)}
                    </TD>
                    <TD>
                      <Badge variant={STATUS_TONE[cheque.status] ?? "neutral"}>
                        {STATUS_LABELS[cheque.status]}
                      </Badge>
                    </TD>
                    {canWrite ? (
                      <TD align="right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              Change
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {(["OPEN", "DEPOSITED", "WITHDRAWN", "BOUNCED"] as const)
                              .filter((s) => s !== cheque.status)
                              .map((s) => (
                                <DropdownMenuItem
                                  key={s}
                                  destructive={s === "BOUNCED"}
                                  onSelect={() => void setStatus(cheque, s)}
                                >
                                  Mark {STATUS_LABELS[s]?.toLowerCase()}
                                </DropdownMenuItem>
                              ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TD>
                    ) : null}
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

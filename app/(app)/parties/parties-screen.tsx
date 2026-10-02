"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  BellRing,
  FileSpreadsheet,
  MessageSquare,
  Pencil,
  Plus,
  Printer,
  Search,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Money, Tooltip } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TBody, TR, TH, TD, TRMessage } from "@/components/ui/table";
import { PageHeader, PARTY_SIBLINGS } from "@/components/patterns/page-header";
import { MasterDetail, ListColumns, ListRow } from "@/components/patterns/master-detail";
import { formatCurrency } from "@/lib/format/number";
import { formatDate } from "@/lib/format/date";
import { stateName } from "@/lib/gst";
import type { PartyListRow, PartyDetail } from "@/server/services/parties";
import type { TransactionRow } from "@/server/services/transactions";

const TYPE_LABELS: Record<string, string> = {
  SALE: "Sale",
  SALE_RETURN: "Credit Note",
  ESTIMATE: "Estimate",
  PROFORMA: "Proforma",
  SALE_ORDER: "Sale Order",
  DELIVERY_CHALLAN: "Delivery Challan",
  PAYMENT_IN: "Payment-In",
  PURCHASE: "Purchase",
  PURCHASE_RETURN: "Debit Note",
  PURCHASE_ORDER: "Purchase Order",
  PAYMENT_OUT: "Payment-Out",
  EXPENSE: "Expense",
};

/** Parties master-detail (ref-02). */
export function PartiesScreen({
  parties,
  detail,
  transactions,
  canWrite,
}: {
  parties: PartyListRow[];
  detail: PartyDetail | null;
  transactions: TransactionRow[];
  canWrite: boolean;
  openNew?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return parties;
    return parties.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.phone?.includes(q) ||
        p.gstin?.toLowerCase().includes(q),
    );
  }, [parties, query]);

  function select(id: string) {
    const next = new URLSearchParams(params.toString());
    next.set("id", id);
    router.replace(`/parties?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Parties"
        siblings={PARTY_SIBLINGS}
        settingsHref="/settings/party"
        actions={
          canWrite ? (
            <Button asChild>
              <Link href="/parties/new">
                <Plus className="size-4" />
                Add Party
              </Link>
            </Button>
          ) : null
        }
      />

      <MasterDetail
        hasSelection={!!detail}
        onBack={() => router.replace("/parties")}
        list={
          <>
            <div className="shrink-0 border-b border-[var(--border-subtle)] p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search Party Name"
                  aria-label="Search Party Name"
                  className="pl-9"
                />
              </div>
            </div>

            <ListColumns left="Party Name" right="Amount" />

            <div className="min-h-0 flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <EmptyState
                  compact
                  tone={query ? "search" : "empty"}
                  title={query ? "No party matches that" : "No parties yet"}
                  description={
                    query ? undefined : "Add your first customer or supplier to get started."
                  }
                  action={
                    !query && canWrite ? (
                      <Button asChild size="sm">
                        <Link href="/parties/new">
                          <Plus className="size-4" />
                          Add Party
                        </Link>
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                filtered.map((party) => {
                  const balance = Number(party.balance);
                  return (
                    <ListRow
                      key={party.id}
                      selected={detail?.id === party.id}
                      onSelect={() => select(party.id)}
                      primary={party.name}
                      secondary={party.groupName ?? undefined}
                      trailing={
                        <Money value={balance} className="tnum">
                          {formatCurrency(Math.abs(balance))}
                        </Money>
                      }
                    />
                  );
                })
              )}
            </div>

            {/* Replaces the reference's phone/Gmail import promo (A-13) */}
            <Link
              href="/utilities/import-parties"
              className="flex shrink-0 items-center gap-3 border-t border-[var(--border-subtle)] bg-brand-50 px-4 py-3 text-[13px] transition-colors hover:bg-brand-100 dark:bg-brand-950/50 dark:hover:bg-brand-900/50"
            >
              <Upload className="size-4 shrink-0 text-brand-600" />
              <span className="flex-1">
                Import parties from <strong>Excel</strong> to add them in bulk.
              </span>
            </Link>
          </>
        }
        detail={
          detail ? (
            <PartyDetailPane detail={detail} transactions={transactions} canWrite={canWrite} />
          ) : (
            <EmptyState
              title="Select a party"
              description="Choose a party on the left to see their balance and transactions."
            />
          )
        }
      />
    </div>
  );
}

function PartyDetailPane({
  detail,
  transactions,
  canWrite,
}: {
  detail: PartyDetail;
  transactions: TransactionRow[];
  canWrite: boolean;
}) {
  const balance = Number(detail.balance);
  const overLimit =
    detail.creditLimit !== null && balance > Number(detail.creditLimit) && balance > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--border-subtle)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-semibold">{detail.name}</h2>
              {canWrite ? (
                <Link
                  href={`/parties/${detail.id}/edit`}
                  className="rounded p-1 text-brand-600 transition-colors hover:bg-[var(--surface-3)]"
                  aria-label={`Edit ${detail.name}`}
                >
                  <Pencil className="size-4" />
                </Link>
              ) : null}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[var(--text-muted)]">
              {detail.phone ? <span>{detail.phone}</span> : null}
              {detail.gstin ? <span>GSTIN: {detail.gstin}</span> : null}
              {detail.stateCode ? <span>{stateName(detail.stateCode)}</span> : null}
              {detail.partyGroup?.name ? (
                <Badge variant="neutral">{detail.partyGroup.name}</Badge>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {detail.phone ? (
              <>
                <Tooltip content="Send SMS">
                  <a
                    href={`sms:${detail.phone}`}
                    className="grid size-9 place-items-center rounded-full bg-[var(--surface-3)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                    aria-label="Send SMS"
                  >
                    <MessageSquare className="size-4" />
                  </a>
                </Tooltip>
                <Tooltip content="Send on WhatsApp">
                  <a
                    href={`https://wa.me/91${detail.phone.replace(/\D/g, "").slice(-10)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="grid size-9 place-items-center rounded-full bg-[var(--color-positive-soft)] text-[var(--color-positive)] transition-colors hover:brightness-95"
                    aria-label="Send on WhatsApp"
                  >
                    <MessageSquare className="size-4" />
                  </a>
                </Tooltip>
              </>
            ) : null}
            <Tooltip content="Payment reminder">
              <Link
                href={`/reports/party-statement?partyId=${detail.id}`}
                className="grid size-9 place-items-center rounded-full bg-[var(--color-warning-soft)] text-[var(--color-warning)] transition-colors hover:brightness-95"
                aria-label="Payment reminder"
              >
                <BellRing className="size-4" />
              </Link>
            </Tooltip>
          </div>
        </div>

        {/* Balance headline */}
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <div>
            <div className="text-[12px] text-[var(--text-muted)]">
              {balance >= 0 ? "To receive" : "To pay"}
            </div>
            <Money value={balance} className="text-xl font-semibold">
              {formatCurrency(Math.abs(balance))}
            </Money>
          </div>

          {detail.creditLimit !== null ? (
            <div>
              <div className="text-[12px] text-[var(--text-muted)]">Credit limit</div>
              <div className="tnum text-[15px] font-medium">
                {formatCurrency(detail.creditLimit)}
                {overLimit ? (
                  <Badge variant="negative" className="ml-2">
                    Exceeded
                  </Badge>
                ) : null}
              </div>
            </div>
          ) : null}

          {detail.paymentTermDays ? (
            <div>
              <div className="text-[12px] text-[var(--text-muted)]">Payment terms</div>
              <div className="text-[15px] font-medium">{detail.paymentTermDays} days</div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Transactions */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3 sm:px-5">
        <h3 className="text-[15px] font-semibold">Transactions</h3>
        <div className="flex items-center gap-1">
          <Link
            href={`/reports/party-statement?partyId=${detail.id}`}
            className="grid size-9 place-items-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-3)]"
            aria-label="Party statement"
            title="Party statement"
          >
            <Printer className="size-[18px]" />
          </Link>
          <Link
            href={`/api/export/party-statement?partyId=${detail.id}`}
            className="grid size-9 place-items-center rounded-lg text-[var(--color-positive)] transition-colors hover:bg-[var(--surface-3)]"
            aria-label="Export to Excel"
            title="Export to Excel"
          >
            <FileSpreadsheet className="size-[18px]" />
          </Link>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Type</TH>
              <TH>Number</TH>
              <TH>Date</TH>
              <TH align="right">Total</TH>
              <TH align="right">Balance</TH>
            </TR>
          </THead>
          <TBody>
            {transactions.length === 0 ? (
              <TRMessage colSpan={5}>
                <EmptyState
                  compact
                  title="No transactions yet"
                  description="Invoices and payments for this party will appear here."
                />
              </TRMessage>
            ) : (
              transactions.map((t) => (
                <TR key={t.id}>
                  <TD className="whitespace-nowrap">{TYPE_LABELS[t.type] ?? t.type}</TD>
                  <TD className="whitespace-nowrap font-medium">{t.displayNumber}</TD>
                  <TD className="whitespace-nowrap">{formatDate(t.date)}</TD>
                  <TD align="right" numeric>
                    {formatCurrency(t.total)}
                  </TD>
                  <TD align="right" numeric>
                    <Money value={Number(t.balanceAmount)}>
                      {formatCurrency(t.balanceAmount)}
                    </Money>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>
      </div>
    </div>
  );
}

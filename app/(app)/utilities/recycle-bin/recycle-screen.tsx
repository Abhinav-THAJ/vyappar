"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TBody, TR, TH, TD, TRMessage } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/patterns/page-header";
import { formatCurrency } from "@/lib/format/number";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { TYPE_LABELS } from "@/lib/validators/transaction";
import { restoreTransactionAction, purgeTransactionAction } from "@/server/actions/utilities";
import type { TransactionType } from "@prisma/client";

interface DeletedRow {
  id: string;
  type: TransactionType;
  displayNumber: string;
  date: string;
  deletedAt: string;
  total: string;
  partyName: string | null;
  firmName: string;
}

/**
 * The Recycle Bin.
 *
 * Restoring re-posts the document, so stock and ledger come back with it —
 * this is not merely un-hiding a row.
 */
export function RecycleScreen({
  rows,
  canRestore,
}: {
  rows: DeletedRow[];
  canRestore: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [purging, setPurging] = React.useState<DeletedRow | null>(null);

  async function restore(row: DeletedRow) {
    setBusy(row.id);
    const result = await restoreTransactionAction({ id: row.id });
    setBusy(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`${row.displayNumber} restored`);
    router.refresh();
  }

  async function purge() {
    if (!purging) return;
    setBusy(purging.id);
    const result = await purgeTransactionAction({ id: purging.id });
    setBusy(null);
    setPurging(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Permanently deleted");
    router.refresh();
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Recycle Bin"
        description="Deleted documents. Restoring one brings its stock and ledger entries back too."
      />

      <div className="p-4 sm:p-6">
        <div className="surface-card overflow-hidden">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Deleted</TH>
                <TH>Type</TH>
                <TH>Number</TH>
                <TH>Party</TH>
                <TH>Date</TH>
                <TH align="right">Total</TH>
                {canRestore ? <TH align="right">Actions</TH> : null}
              </TR>
            </THead>
            <TBody>
              {rows.length === 0 ? (
                <TRMessage colSpan={canRestore ? 7 : 6}>
                  <EmptyState
                    title="Nothing deleted"
                    description="Documents you delete appear here so they can be brought back."
                  />
                </TRMessage>
              ) : (
                rows.map((row) => (
                  <TR key={row.id}>
                    <TD className="whitespace-nowrap text-[var(--text-secondary)]">
                      {formatDateTime(row.deletedAt)}
                    </TD>
                    <TD>{TYPE_LABELS[row.type] ?? row.type}</TD>
                    <TD className="font-medium">{row.displayNumber}</TD>
                    <TD>{row.partyName ?? "—"}</TD>
                    <TD className="whitespace-nowrap">{formatDate(row.date)}</TD>
                    <TD align="right" numeric>
                      {formatCurrency(row.total)}
                    </TD>
                    {canRestore ? (
                      <TD align="right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void restore(row)}
                            loading={busy === row.id}
                          >
                            <RotateCcw className="size-4" />
                            Restore
                          </Button>
                          <Button
                            variant="ghost"
                            size="iconSm"
                            onClick={() => setPurging(row)}
                            aria-label={`Permanently delete ${row.displayNumber}`}
                          >
                            <Trash2 className="size-4 text-[var(--color-negative)]" />
                          </Button>
                        </div>
                      </TD>
                    ) : null}
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!purging} onOpenChange={(v) => (v ? null : setPurging(null))}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Delete permanently?</DialogTitle>
            <DialogDescription>
              {purging
                ? `${purging.displayNumber} will be removed for good. This cannot be undone.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <p className="text-[13px] text-[var(--text-secondary)]">
              If you might need this document for an audit, leave it in the recycle bin
              instead — it costs nothing to keep.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPurging(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void purge()}
              loading={busy === purging?.id}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

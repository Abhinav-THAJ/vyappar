"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/controls";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveNumberSequencesAction } from "@/server/actions/settings";
import { TYPE_LABELS } from "@/lib/validators/transaction";
import type { TransactionType } from "@prisma/client";

export interface SequenceRow {
  id: string;
  firmId: string;
  firmName: string;
  type: TransactionType;
  financialYear: string;
  prefix: string;
  nextNumber: number;
  resetYearly: boolean;
}

/**
 * Per-firm document numbering.
 *
 * Prefixes may be empty — the reference firm numbers its invoices as bare
 * integers, so a blank prefix has to round-trip (D-09).
 */
export function NumberSequences({
  sequences,
  firms,
  canWrite,
}: {
  sequences: SequenceRow[];
  firms: { id: string; name: string }[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [firmId, setFirmId] = React.useState(firms[0]?.id ?? "");
  const [rows, setRows] = React.useState(sequences);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => setRows(sequences), [sequences]);

  const visible = rows.filter((r) => r.firmId === firmId);
  const dirty = JSON.stringify(rows) !== JSON.stringify(sequences);

  function update(id: string, patch: Partial<SequenceRow>) {
    setRows((current) => current.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function save() {
    setSaving(true);

    const result = await saveNumberSequencesAction({
      updates: rows.map((r) => ({
        id: r.id,
        prefix: r.prefix,
        nextNumber: r.nextNumber,
        resetYearly: r.resetYearly,
      })),
    });

    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Numbering updated");
    router.refresh();
  }

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] p-5">
        <div>
          <h2 className="text-[15px] font-semibold">Document numbering</h2>
          <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">
            Each firm runs its own series. Leave a prefix blank for plain numbers.
          </p>
        </div>

        {firms.length > 1 ? (
          <Select value={firmId} onValueChange={setFirmId}>
            <SelectTrigger className="w-56" aria-label="Firm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {firms.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Document</TH>
            <TH>Financial year</TH>
            <TH>Prefix</TH>
            <TH align="right">Next number</TH>
            <TH>Preview</TH>
            <TH align="center">Reset yearly</TH>
          </TR>
        </THead>
        <TBody>
          {visible.map((row) => (
            <TR key={row.id}>
              <TD className="font-medium">{TYPE_LABELS[row.type]}</TD>
              <TD className="text-[var(--text-secondary)]">{row.financialYear}</TD>
              <TD>
                <Input
                  value={row.prefix}
                  onChange={(e) => update(row.id, { prefix: e.target.value })}
                  className="h-8 w-28"
                  placeholder="(none)"
                  disabled={!canWrite}
                  aria-label={`Prefix for ${TYPE_LABELS[row.type]}`}
                />
              </TD>
              <TD align="right">
                <Input
                  type="number"
                  min={1}
                  value={row.nextNumber}
                  onChange={(e) =>
                    update(row.id, { nextNumber: Math.max(1, Number(e.target.value) || 1) })
                  }
                  className="ml-auto h-8 w-24 text-right"
                  disabled={!canWrite}
                  aria-label={`Next number for ${TYPE_LABELS[row.type]}`}
                />
              </TD>
              <TD className="tnum text-[var(--text-secondary)]">
                {row.prefix}
                {row.nextNumber}
              </TD>
              <TD align="center">
                <Checkbox
                  checked={row.resetYearly}
                  onCheckedChange={(v) => update(row.id, { resetYearly: v === true })}
                  disabled={!canWrite}
                  aria-label={`Reset ${TYPE_LABELS[row.type]} numbering each year`}
                />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      {canWrite && dirty ? (
        <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] p-4">
          <Button variant="ghost" size="sm" onClick={() => setRows(sequences)}>
            Discard
          </Button>
          <Button size="sm" onClick={() => void save()} loading={saving}>
            <Save className="size-4" />
            Save numbering
          </Button>
        </div>
      ) : null}
    </div>
  );
}

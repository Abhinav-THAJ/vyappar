"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Field } from "@/components/forms/form-field";
import { toDateInputValue } from "@/lib/format/date";
import { adjustCashAction } from "@/server/actions/cashbank";

/** Adjust cash in hand after a physical count. */
export function CashActions() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [direction, setDirection] = React.useState<"ADD" | "REDUCE">("ADD");
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState(toDateInputValue(new Date()));
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  function start(dir: "ADD" | "REDUCE") {
    setDirection(dir);
    setAmount("");
    setDate(toDateInputValue(new Date()));
    setNotes("");
    setError(null);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    setError(null);

    const result = await adjustCashAction({ direction, amount, date, notes: notes || undefined });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success("Cash adjusted");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => start("ADD")}>
          <Plus className="size-4" />
          Add cash
        </Button>
        <Button variant="outline" size="sm" onClick={() => start("REDUCE")}>
          <Minus className="size-4" />
          Reduce cash
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{direction === "ADD" ? "Add cash" : "Reduce cash"}</DialogTitle>
            <DialogDescription>
              Records a correction against capital, so it never appears as income or expense.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            {error ? (
              <p className="rounded-lg bg-[var(--color-negative-soft)] px-3 py-2 text-[13px] text-[var(--color-negative)]">
                {error}
              </p>
            ) : null}

            <Field id="amount" label="Amount" required>
              <Input
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                autoFocus
                placeholder="0.00"
              />
            </Field>

            <Field id="date" label="Date" required>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>

            <Field id="notes" label="Reason">
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Physical count correction"
              />
            </Field>
          </DialogBody>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} loading={saving}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/controls";
import { Field, FormError } from "@/components/forms/form-field";
import { FormShell, FormSection, FormGrid } from "@/components/forms/form-shell";
import { Money } from "@/components/ui/display";
import { formatQty } from "@/lib/format/number";
import { toDateInputValue } from "@/lib/format/date";
import { stockAdjustSchema, type StockAdjustInput } from "@/lib/validators/item";
import { adjustStockAction } from "@/server/actions/items";
import { cn } from "@/lib/utils";

/** Adjust Item (ref-03): writes a StockMovement, never a stored counter. */
export function AdjustStockForm({
  item,
}: {
  item: { id: string; name: string; qty: string; unitShort: string | null; purchasePrice: string };
}) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState,
  } = useForm<StockAdjustInput>({
    resolver: zodResolver(stockAdjustSchema),
    defaultValues: {
      itemId: item.id,
      direction: "ADD",
      qty: "",
      rate: item.purchasePrice,
      date: toDateInputValue(new Date()),
      note: undefined,
    },
  });

  const values = watch();
  const current = Number(item.qty);
  const delta = Number(values.qty || 0);
  const resulting = values.direction === "ADD" ? current + delta : current - delta;

  async function onSubmit(input: StockAdjustInput) {
    setFormError(null);
    const result = await adjustStockAction(input);

    if (!result.ok) {
      setFormError(result.error);
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as keyof StockAdjustInput, { message: messages[0] });
      }
      return;
    }

    toast.success(`Stock is now ${formatQty(result.data.onHand)}`);
    router.push(`/items?id=${item.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormShell
        title="Adjust Item"
        description={item.name}
        width="md"
        onCancel={() => router.push(`/items?id=${item.id}`)}
        footer={
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push(`/items?id=${item.id}`)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={formState.isSubmitting}>
              Save adjustment
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormError message={formError} />

          <FormSection>
            <RadioGroup
              value={values.direction}
              onValueChange={(v) => setValue("direction", v as "ADD" | "REDUCE")}
              className="grid-cols-2 gap-3"
            >
              {(["ADD", "REDUCE"] as const).map((dir) => (
                <label
                  key={dir}
                  htmlFor={`dir-${dir}`}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border-2 p-4 transition-colors",
                    values.direction === dir
                      ? "border-brand-500 bg-brand-50/60 dark:bg-brand-950/40"
                      : "border-[var(--border-subtle)] hover:border-[var(--border-strong)]",
                  )}
                >
                  <RadioGroupItem value={dir} id={`dir-${dir}`} />
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {dir === "ADD" ? (
                      <Plus className="size-4 text-[var(--color-positive)]" />
                    ) : (
                      <Minus className="size-4 text-[var(--color-negative)]" />
                    )}
                    {dir === "ADD" ? "Add stock" : "Reduce stock"}
                  </span>
                </label>
              ))}
            </RadioGroup>

            <FormGrid className="mt-5">
              <Field
                id="qty"
                label={`Quantity${item.unitShort ? ` (${item.unitShort})` : ""}`}
                required
                error={formState.errors.qty?.message}
              >
                <Input
                  id="qty"
                  inputMode="decimal"
                  autoFocus
                  placeholder="0"
                  invalid={!!formState.errors.qty}
                  {...register("qty")}
                />
              </Field>

              <Field
                id="rate"
                label="Price per unit"
                hint="Used to value the stock."
                error={formState.errors.rate?.message}
              >
                <Input id="rate" inputMode="decimal" {...register("rate")} />
              </Field>

              <Field id="date" label="Date" required error={formState.errors.date?.message}>
                <Input
                  id="date"
                  type="date"
                  invalid={!!formState.errors.date}
                  {...register("date")}
                />
              </Field>

              <Field id="note" label="Reason" className="sm:col-span-2">
                <Textarea
                  id="note"
                  rows={2}
                  placeholder="Damaged in transit, stock count correction, …"
                  {...register("note")}
                />
              </Field>
            </FormGrid>
          </FormSection>

          <FormSection>
            <div className="flex flex-wrap items-center justify-between gap-4 text-[13px]">
              <div>
                <div className="text-[var(--text-muted)]">Current stock</div>
                <Money value={current} className="text-lg font-semibold">
                  {formatQty(item.qty)}
                </Money>
              </div>
              <div className="text-2xl text-[var(--text-muted)]" aria-hidden>
                →
              </div>
              <div className="text-right">
                <div className="text-[var(--text-muted)]">After adjustment</div>
                <Money value={resulting} className="text-lg font-semibold">
                  {formatQty(String(resulting))}
                </Money>
              </div>
            </div>

            {resulting < 0 ? (
              <p className="mt-3 rounded-lg bg-[var(--color-warning-soft)] px-3 py-2 text-[12px] text-[var(--color-warning)]">
                This leaves the item with negative stock. That is allowed unless
                &ldquo;Stop Sale on Negative Stock&rdquo; is turned on in Settings.
              </p>
            ) : null}
          </FormSection>
        </div>
      </FormShell>
    </form>
  );
}

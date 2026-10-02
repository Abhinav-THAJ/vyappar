"use client";

import * as React from "react";
import { Trash2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/forms/combobox";
import { formatCurrency } from "@/lib/format/number";
import { searchItemsAction, type ItemPickerRow } from "@/server/actions/items";
import type { TransactionLineInput } from "@/lib/validators/transaction";
import type { CalcLineResult } from "@/lib/calc";
import { cn } from "@/lib/utils";

export interface GridLine extends TransactionLineInput {
  key: string;
  itemName?: string;
}

export interface GridOptions {
  showDiscount: boolean;
  showFreeQty: boolean;
  showDescription: boolean;
  isPurchase: boolean;
  gstEnabled: boolean;
}

/**
 * The invoice line grid.
 *
 * Keyboard-first, as the brief requires: Tab and Enter walk the cells, Alt+N
 * adds a row, and the last row auto-extends when you type into it, so entry
 * never needs the mouse.
 */
export function LineItemGrid({
  lines,
  results,
  options,
  taxRates,
  units,
  onChange,
  onAddLine,
  onRemoveLine,
  errors,
}: {
  lines: GridLine[];
  results: CalcLineResult[];
  options: GridOptions;
  taxRates: { id: string; name: string; rate: string }[];
  units: { id: string; shortName: string }[];
  onChange: (key: string, patch: Partial<GridLine>) => void;
  onAddLine: () => void;
  onRemoveLine: (key: string) => void;
  errors?: Record<number, Record<string, string>>;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Alt+N adds a row from anywhere inside the grid.
  React.useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        onAddLine();
      }
    }

    node.addEventListener("keydown", onKeyDown);
    return () => node.removeEventListener("keydown", onKeyDown);
  }, [onAddLine]);

  /** Enter moves down the same column rather than submitting the form. */
  function onCellKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();

    const cell = event.currentTarget;
    const column = cell.dataset.col;
    const row = Number(cell.dataset.row);
    const next = containerRef.current?.querySelector<HTMLInputElement>(
      `[data-col="${column}"][data-row="${row + 1}"]`,
    );

    if (next) next.focus();
    else onAddLine();
  }

  const searchItems = React.useCallback(async (query: string): Promise<ComboboxOption[]> => {
    const rows = await searchItemsAction(query);
    itemCache.current = new Map(rows.map((r) => [r.id, r]));
    return rows.map((r) => ({
      value: r.id,
      label: r.name,
      hint: [r.sku, r.hsnSac ? `HSN ${r.hsnSac}` : null].filter(Boolean).join(" · ") || undefined,
      trailing: formatCurrency(options.isPurchase ? r.purchasePrice : r.salePrice),
    }));
  }, [options.isPurchase]);

  const itemCache = React.useRef<Map<string, ItemPickerRow>>(new Map());

  function pickItem(key: string, option: ComboboxOption) {
    const item = itemCache.current.get(option.value);
    if (!item) {
      onChange(key, { itemId: option.value, itemName: option.label });
      return;
    }

    onChange(key, {
      itemId: item.id,
      itemName: item.name,
      hsnSac: item.hsnSac ?? undefined,
      unitId: item.unitId ?? undefined,
      rate: options.isPurchase ? item.purchasePrice : item.salePrice,
      rateIsTaxInclusive: options.isPurchase
        ? item.purchasePriceTaxInclusive
        : item.salePriceTaxInclusive,
      taxRateId: item.taxRateId ?? undefined,
      taxRateValue: item.taxRateValue,
      cessRate: item.cessRate,
    });
  }

  const colCount =
    4 + (options.showFreeQty ? 1 : 0) + (options.showDiscount ? 1 : 0) + (options.gstEnabled ? 1 : 0) + 2;

  return (
    <div ref={containerRef} className="surface-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-2)] text-left">
              <Th className="w-10">#</Th>
              <Th className="min-w-[220px]">Item</Th>
              <Th className="w-24">HSN/SAC</Th>
              <Th className="w-24" align="right">
                Qty
              </Th>
              {options.showFreeQty ? (
                <Th className="w-20" align="right">
                  Free
                </Th>
              ) : null}
              <Th className="w-20">Unit</Th>
              <Th className="w-28" align="right">
                Price/Unit
              </Th>
              {options.showDiscount ? (
                <Th className="w-28" align="right">
                  Discount
                </Th>
              ) : null}
              {options.gstEnabled ? <Th className="w-28">Tax</Th> : null}
              <Th className="w-28" align="right">
                Amount
              </Th>
              <Th className="w-10" />
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--border-subtle)]">
            {lines.map((line, index) => {
              const result = results[index];
              const rowErrors = errors?.[index] ?? {};

              return (
                <React.Fragment key={line.key}>
                  <tr className="align-top">
                    <Td className="pt-4 text-[var(--text-muted)]">{index + 1}</Td>

                    <Td>
                      <Combobox
                        value={
                          line.itemId
                            ? { value: line.itemId, label: line.itemName ?? "Item" }
                            : null
                        }
                        onChange={(option) => pickItem(line.key, option)}
                        onSearch={searchItems}
                        placeholder="Search item"
                        emptyLabel="No item matches"
                        invalid={!!rowErrors.itemId}
                        createLabel={(q) => `Add "${q}" as a new item`}
                        onCreate={(q) => onChange(line.key, { itemName: q, description: q })}
                      />
                      {rowErrors.itemId ? <CellError message={rowErrors.itemId} /> : null}
                      {options.showDescription ? (
                        <Input
                          value={line.description ?? ""}
                          onChange={(e) => onChange(line.key, { description: e.target.value })}
                          placeholder="Description"
                          className="mt-1.5 h-8 text-[12px]"
                          data-col="description"
                          data-row={index}
                          onKeyDown={onCellKeyDown}
                        />
                      ) : null}
                    </Td>

                    <Td>
                      <Input
                        value={line.hsnSac ?? ""}
                        onChange={(e) => onChange(line.key, { hsnSac: e.target.value })}
                        className="h-9"
                        inputMode="numeric"
                        maxLength={8}
                        data-col="hsn"
                        data-row={index}
                        onKeyDown={onCellKeyDown}
                      />
                    </Td>

                    <Td>
                      <Input
                        value={line.qty}
                        onChange={(e) => onChange(line.key, { qty: e.target.value })}
                        className="h-9 text-right"
                        inputMode="decimal"
                        invalid={!!rowErrors.qty}
                        data-col="qty"
                        data-row={index}
                        onKeyDown={onCellKeyDown}
                      />
                      {rowErrors.qty ? <CellError message={rowErrors.qty} /> : null}
                    </Td>

                    {options.showFreeQty ? (
                      <Td>
                        <Input
                          value={line.freeQty ?? ""}
                          onChange={(e) => onChange(line.key, { freeQty: e.target.value })}
                          className="h-9 text-right"
                          inputMode="decimal"
                          data-col="freeQty"
                          data-row={index}
                          onKeyDown={onCellKeyDown}
                        />
                      </Td>
                    ) : null}

                    <Td>
                      <select
                        value={line.unitId ?? ""}
                        onChange={(e) =>
                          onChange(line.key, { unitId: e.target.value || undefined })
                        }
                        className="h-9 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-[13px]"
                        aria-label="Unit"
                      >
                        <option value="">—</option>
                        {units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.shortName}
                          </option>
                        ))}
                      </select>
                    </Td>

                    <Td>
                      <Input
                        value={line.rate}
                        onChange={(e) => onChange(line.key, { rate: e.target.value })}
                        className="h-9 text-right"
                        inputMode="decimal"
                        data-col="rate"
                        data-row={index}
                        onKeyDown={onCellKeyDown}
                      />
                      <label className="mt-1 flex items-center justify-end gap-1 text-[11px] text-[var(--text-muted)]">
                        <input
                          type="checkbox"
                          checked={line.rateIsTaxInclusive}
                          onChange={(e) =>
                            onChange(line.key, { rateIsTaxInclusive: e.target.checked })
                          }
                          className="size-3"
                        />
                        incl. tax
                      </label>
                    </Td>

                    {options.showDiscount ? (
                      <Td>
                        <div className="flex items-center gap-1">
                          <Input
                            value={line.discountValue ?? ""}
                            onChange={(e) =>
                              onChange(line.key, { discountValue: e.target.value })
                            }
                            className="h-9 text-right"
                            inputMode="decimal"
                            placeholder="0"
                            data-col="discount"
                            data-row={index}
                            onKeyDown={onCellKeyDown}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              onChange(line.key, { discountIsPercent: !line.discountIsPercent })
                            }
                            className="h-9 w-8 shrink-0 rounded-lg border border-[var(--border-strong)] text-[12px] font-medium"
                            aria-label={
                              line.discountIsPercent
                                ? "Discount is a percentage"
                                : "Discount is an amount"
                            }
                          >
                            {line.discountIsPercent ? "%" : "₹"}
                          </button>
                        </div>
                        {rowErrors.discountValue ? (
                          <CellError message={rowErrors.discountValue} />
                        ) : null}
                      </Td>
                    ) : null}

                    {options.gstEnabled ? (
                      <Td>
                        <select
                          value={line.taxRateId ?? ""}
                          onChange={(e) => {
                            const id = e.target.value || undefined;
                            const rate = taxRates.find((t) => t.id === id);
                            onChange(line.key, {
                              taxRateId: id,
                              taxRateValue: rate?.rate ?? "0",
                            });
                          }}
                          className="h-9 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-[13px]"
                          aria-label="Tax rate"
                        >
                          <option value="">None</option>
                          {taxRates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        {result && Number(result.cgst) + Number(result.igst) > 0 ? (
                          <div className="mt-1 text-right text-[11px] text-[var(--text-muted)]">
                            {formatCurrency(
                              Number(result.cgst) + Number(result.sgst) + Number(result.igst),
                            )}
                          </div>
                        ) : null}
                      </Td>
                    ) : null}

                    <Td align="right" className="pt-4">
                      <span className="tnum font-medium">
                        {formatCurrency(result?.amount ?? 0)}
                      </span>
                    </Td>

                    <Td className="pt-3">
                      <button
                        type="button"
                        onClick={() => onRemoveLine(line.key)}
                        disabled={lines.length === 1}
                        className="grid size-8 place-items-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--color-negative)] disabled:opacity-30"
                        aria-label={`Remove line ${index + 1}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </Td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>

          <tfoot>
            <tr>
              <td colSpan={colCount} className="p-3">
                <Button type="button" variant="ghost" size="sm" onClick={onAddLine}>
                  <Plus className="size-4" />
                  Add row
                  <kbd className="ml-1 rounded border border-[var(--border-strong)] px-1 text-[10px] text-[var(--text-muted)]">
                    Alt+N
                  </kbd>
                </Button>
              </td>
            </tr>
          </tfoot>
        </table>
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
      scope="col"
      className={cn(
        "px-2 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]",
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
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  return (
    <td className={cn("px-2 py-2", align === "right" && "text-right", className)}>{children}</td>
  );
}

function CellError({ message }: { message: string }) {
  return (
    <p className="mt-1 text-[11px] text-[var(--color-negative)]" role="alert">
      {message}
    </p>
  );
}

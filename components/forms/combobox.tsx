"use client";

import * as React from "react";
import { Command } from "cmdk";
import { Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/display";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Second line under the label. */
  hint?: string;
  /** Right-aligned text, e.g. a balance or a price. */
  trailing?: string;
}

/**
 * A searchable picker that queries the server as you type, with an inline
 * "create" row so a party or item can be added without leaving the invoice —
 * the behaviour the brief asks for on the transaction form.
 */
export function Combobox({
  value,
  onChange,
  onSearch,
  placeholder = "Search…",
  emptyLabel = "No match",
  createLabel,
  onCreate,
  disabled,
  invalid,
  className,
  id,
  autoFocus,
}: {
  value: ComboboxOption | null;
  onChange: (option: ComboboxOption) => void;
  onSearch: (query: string) => Promise<ComboboxOption[]>;
  placeholder?: string;
  emptyLabel?: string;
  createLabel?: (query: string) => string;
  onCreate?: (query: string) => void | Promise<void>;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  id?: string;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [options, setOptions] = React.useState<ComboboxOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const requestId = React.useRef(0);
  // The combobox role requires aria-controls pointing at the listbox.
  const listboxId = React.useId();

  // Debounced search; stale responses are discarded by sequence number.
  React.useEffect(() => {
    if (!open) return;
    const id = ++requestId.current;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const results = await onSearch(query);
        if (id === requestId.current) setOptions(results);
      } catch {
        if (id === requestId.current) setOptions([]);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query, open, onSearch]);

  const showCreate =
    !!onCreate &&
    query.trim().length > 0 &&
    !options.some((o) => o.label.toLowerCase() === query.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          disabled={disabled}
          autoFocus={autoFocus}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-lg border bg-[var(--surface)] px-3 text-left text-sm transition-colors",
            "disabled:cursor-not-allowed disabled:opacity-60",
            invalid ? "border-[var(--color-negative)]" : "border-[var(--border-strong)]",
            className,
          )}
        >
          <span className={cn("truncate", !value && "text-[var(--text-muted)]")}>
            {value?.label ?? placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-[var(--text-muted)]" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[min(28rem,calc(100vw-2rem))] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false} loop>
          <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3">
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder={placeholder}
              className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
            />
            {loading ? (
              <Loader2 className="size-4 animate-spin text-[var(--text-muted)]" />
            ) : null}
          </div>

          <Command.List id={listboxId} className="max-h-64 overflow-y-auto p-1">
            {!loading && options.length === 0 && !showCreate ? (
              <div className="py-8 text-center text-[13px] text-[var(--text-muted)]">
                {emptyLabel}
              </div>
            ) : null}

            {options.map((option) => (
              <Command.Item
                key={option.value}
                value={option.value}
                onSelect={() => {
                  onChange(option);
                  setOpen(false);
                  setQuery("");
                }}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13px] data-[selected=true]:bg-[var(--surface-3)]"
              >
                <Check
                  className={cn(
                    "size-4 shrink-0 text-brand-600",
                    value?.value === option.value ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{option.label}</span>
                  {option.hint ? (
                    <span className="block truncate text-[11px] text-[var(--text-muted)]">
                      {option.hint}
                    </span>
                  ) : null}
                </span>
                {option.trailing ? (
                  <span className="tnum shrink-0 text-[12px] text-[var(--text-muted)]">
                    {option.trailing}
                  </span>
                ) : null}
              </Command.Item>
            ))}

            {showCreate ? (
              <Command.Item
                value={`__create__${query}`}
                onSelect={async () => {
                  await onCreate?.(query.trim());
                  setOpen(false);
                  setQuery("");
                }}
                className="mt-1 flex cursor-pointer items-center gap-2 rounded-md border-t border-[var(--border-subtle)] px-2.5 py-2.5 text-[13px] font-medium text-brand-700 data-[selected=true]:bg-brand-50 dark:text-brand-300 dark:data-[selected=true]:bg-brand-950"
              >
                <Plus className="size-4" />
                {createLabel ? createLabel(query.trim()) : `Add "${query.trim()}"`}
              </Command.Item>
            ) : null}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

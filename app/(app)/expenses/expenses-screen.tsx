"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { MoreVertical, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TBody, TR, TH, TD, TRMessage } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, PURCHASE_SIBLINGS } from "@/components/patterns/page-header";
import { MasterDetail, ListColumns, ListRow } from "@/components/patterns/master-detail";
import { Field } from "@/components/forms/form-field";
import { formatCurrency } from "@/lib/format/number";
import { formatDate } from "@/lib/format/date";
import {
  saveExpenseCategoryAction,
  deleteExpenseCategoryAction,
} from "@/server/actions/expenses";

export interface ExpenseCategoryRow {
  id: string;
  name: string;
  expenseType: "DIRECT" | "INDIRECT";
  total: string;
  balance: string;
}

export interface ExpenseRow {
  id: string;
  displayNumber: string;
  date: string;
  partyName: string | null;
  paymentMode: string | null;
  total: string;
  balance: string;
}

/** Expenses (ref-07): categories on the left, that category's entries on the right. */
export function ExpensesScreen({
  categories,
  selected,
  expenses,
  canWrite,
}: {
  categories: ExpenseCategoryRow[];
  selected: ExpenseCategoryRow | null;
  expenses: ExpenseRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<ExpenseCategoryRow | null>(null);
  const [creating, setCreating] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, query]);

  function select(id: string) {
    const next = new URLSearchParams(params.toString());
    next.set("categoryId", id);
    router.replace(`/expenses?${next.toString()}`, { scroll: false });
  }

  async function remove(category: ExpenseCategoryRow) {
    const result = await deleteExpenseCategoryAction({ id: category.id });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${category.name} removed`);
    router.replace("/expenses");
    router.refresh();
  }

  return (
    <div className="flex min-h-full flex-col">
      <Tabs value="category">
        <TabsList>
          <TabsTrigger value="category">Category</TabsTrigger>
          <TabsTrigger value="items" onClick={() => router.push("/expenses/items")}>
            Items
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <PageHeader
        title="Expenses"
        siblings={PURCHASE_SIBLINGS}
        actions={
          canWrite ? (
            <Button onClick={() => router.push("/expenses/new")}>
              <Plus className="size-4" />
              Add Expense
            </Button>
          ) : null
        }
      />

      <MasterDetail
        hasSelection={!!selected}
        onBack={() => router.replace("/expenses")}
        list={
          <>
            <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] p-3">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search categories"
                  aria-label="Search categories"
                  className="pl-9"
                />
              </div>
              {canWrite ? (
                <Button size="icon" onClick={() => setCreating(true)} aria-label="Add category">
                  <Plus className="size-4" />
                </Button>
              ) : null}
            </div>

            <ListColumns left="Category" right="Amount" />

            <div className="min-h-0 flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <EmptyState
                  compact
                  tone={query ? "search" : "empty"}
                  title={query ? "No category matches that" : "No expense categories"}
                  description={query ? undefined : "Group your spending to see it in Profit & Loss."}
                  action={
                    !query && canWrite ? (
                      <Button size="sm" onClick={() => setCreating(true)}>
                        <Plus className="size-4" />
                        Add Category
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                filtered.map((category) => (
                  <ListRow
                    key={category.id}
                    selected={selected?.id === category.id}
                    onSelect={() => select(category.id)}
                    primary={category.name}
                    secondary={category.expenseType === "DIRECT" ? "Direct Expense" : "Indirect Expense"}
                    trailing={
                      <span className="tnum">{formatCurrency(category.total, { decimals: 0 })}</span>
                    }
                    actions={
                      canWrite ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="grid size-8 place-items-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-3)]"
                              aria-label={`Options for ${category.name}`}
                            >
                              <MoreVertical className="size-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setEditing(category)}>
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem destructive onSelect={() => void remove(category)}>
                              <Trash2 />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null
                    }
                  />
                ))
              )}
            </div>
          </>
        }
        detail={
          selected ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-[var(--border-subtle)] p-4 sm:p-5">
                <div>
                  <h2 className="text-lg font-semibold uppercase">{selected.name}</h2>
                  <Badge
                    variant={selected.expenseType === "DIRECT" ? "warning" : "neutral"}
                    className="mt-1.5"
                  >
                    {selected.expenseType === "DIRECT" ? "Direct Expense" : "Indirect Expense"}
                  </Badge>
                </div>
                <div className="text-right text-[13px]">
                  <div>
                    <span className="text-[var(--text-muted)]">Total : </span>
                    <span className="tnum font-semibold">{formatCurrency(selected.total)}</span>
                  </div>
                  <div className="mt-0.5">
                    <span className="text-[var(--text-muted)]">Balance : </span>
                    <span className="tnum font-semibold">{formatCurrency(selected.balance)}</span>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                <Table>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Date</TH>
                      <TH>Exp No.</TH>
                      <TH>Party</TH>
                      <TH>Payment Type</TH>
                      <TH align="right">Amount</TH>
                      <TH align="right">Balance</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {expenses.length === 0 ? (
                      <TRMessage colSpan={6}>
                        <EmptyState
                          title="No transactions to show"
                          description="Expenses recorded against this category will appear here."
                          action={
                            canWrite ? (
                              <Button onClick={() => router.push("/expenses/new")}>
                                <Plus className="size-4" />
                                Add Expense
                              </Button>
                            ) : undefined
                          }
                        />
                      </TRMessage>
                    ) : (
                      expenses.map((expense) => (
                        <TR key={expense.id}>
                          <TD>{formatDate(expense.date)}</TD>
                          <TD className="font-medium">{expense.displayNumber}</TD>
                          <TD>{expense.partyName ?? "—"}</TD>
                          <TD className="text-[var(--text-secondary)]">
                            {expense.paymentMode ?? "—"}
                          </TD>
                          <TD align="right" numeric>
                            {formatCurrency(expense.total)}
                          </TD>
                          <TD align="right" numeric>
                            {formatCurrency(expense.balance)}
                          </TD>
                        </TR>
                      ))
                    )}
                  </TBody>
                </Table>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Select a category"
              description="Choose a category on the left to see its expenses."
            />
          )
        }
      />

      <CategoryDialog
        open={creating || !!editing}
        category={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function CategoryDialog({
  open,
  category,
  onClose,
  onSaved,
}: {
  open: boolean;
  category: ExpenseCategoryRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState("");
  const [expenseType, setExpenseType] = React.useState<"DIRECT" | "INDIRECT">("INDIRECT");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(category?.name ?? "");
    setExpenseType(category?.expenseType ?? "INDIRECT");
    setError(null);
  }, [open, category]);

  async function save() {
    setSaving(true);
    setError(null);

    const result = await saveExpenseCategoryAction({
      id: category?.id,
      name,
      expenseType,
    });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success(category ? "Category renamed" : `${name} added`);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? null : onClose())}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{category ? "Rename category" : "Add expense category"}</DialogTitle>
          <DialogDescription>
            Direct expenses sit above the gross-profit line; indirect ones below it.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {error ? (
            <p className="rounded-lg bg-[var(--color-negative-soft)] px-3 py-2 text-[13px] text-[var(--color-negative)]">
              {error}
            </p>
          ) : null}

          <Field id="categoryName" label="Name" required>
            <Input
              id="categoryName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="Transport"
            />
          </Field>

          <Field id="expenseType" label="Expense type" required>
            <Select
              value={expenseType}
              onValueChange={(v) => setExpenseType(v as "DIRECT" | "INDIRECT")}
            >
              <SelectTrigger id="expenseType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DIRECT">Direct Expense</SelectItem>
                <SelectItem value="INDIRECT">Indirect Expense</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={saving}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

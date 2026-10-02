"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Building2, Check, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/controls";
import { Badge } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { FormGrid } from "@/components/forms/form-shell";
import { INDIAN_STATES, validateGstin, stateName } from "@/lib/gst";
import { saveFirmAction } from "@/server/actions/company";
import { cn } from "@/lib/utils";

export interface FirmRow {
  id: string;
  name: string;
  gstin: string | null;
  stateCode: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankIfsc: string | null;
  upiId: string | null;
  termsAndConditions: string | null;
  isDefault: boolean;
}

/**
 * Firms inside the company.
 *
 * Each firm has its own GSTIN, bank details and invoice series, which is what
 * makes the two-level model (D-20) worth having.
 */
export function FirmsScreen({
  firms,
  canWrite,
  isMultiFirm,
}: {
  firms: FirmRow[];
  canWrite: boolean;
  isMultiFirm: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [editing, setEditing] = React.useState<FirmRow | null>(null);
  const [creating, setCreating] = React.useState(false);

  // Deep link from the General tab: /settings/firms?edit=<id>
  React.useEffect(() => {
    const editId = params.get("edit");
    if (editId) {
      const firm = firms.find((f) => f.id === editId);
      if (firm) setEditing(firm);
    }
  }, [params, firms]);

  const canAdd = canWrite && (isMultiFirm || firms.length === 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">Firms</h2>
          <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">
            {isMultiFirm
              ? "Parties and items are shared; invoices are numbered per firm."
              : "Turn on Multi Firm in General settings to add more than one."}
          </p>
        </div>
        {canAdd ? (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Add Firm
          </Button>
        ) : null}
      </div>

      {firms.length === 0 ? (
        <div className="surface-card">
          <EmptyState
            title="No firms yet"
            description="A firm is what issues invoices. Add one before you start billing."
            action={
              canWrite ? (
                <Button onClick={() => setCreating(true)}>
                  <Plus className="size-4" />
                  Add Firm
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {firms.map((firm) => (
            <div
              key={firm.id}
              className={cn(
                "surface-card p-5",
                firm.isDefault && "ring-1 ring-brand-400",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                    <Building2 className="size-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[15px] font-semibold">{firm.name}</span>
                      {firm.isDefault ? (
                        <Badge variant="brand">
                          <Check className="size-3" />
                          Default
                        </Badge>
                      ) : null}
                    </div>
                    <div className="truncate text-[12px] text-[var(--text-muted)]">
                      {stateName(firm.stateCode)}
                    </div>
                  </div>
                </div>

                {canWrite ? (
                  <Button variant="ghost" size="iconSm" onClick={() => setEditing(firm)}>
                    <Pencil className="size-4" />
                    <span className="sr-only">Edit {firm.name}</span>
                  </Button>
                ) : null}
              </div>

              <dl className="mt-4 space-y-1 text-[12px] text-[var(--text-muted)]">
                {firm.gstin ? (
                  <div className="flex justify-between gap-2">
                    <dt>GSTIN</dt>
                    <dd className="truncate font-medium text-[var(--text-primary)]">
                      {firm.gstin}
                    </dd>
                  </div>
                ) : null}
                {firm.phone ? (
                  <div className="flex justify-between gap-2">
                    <dt>Phone</dt>
                    <dd className="truncate">{firm.phone}</dd>
                  </div>
                ) : null}
                {firm.bankAccountNo ? (
                  <div className="flex justify-between gap-2">
                    <dt>Bank A/c</dt>
                    <dd className="truncate">{firm.bankAccountNo}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ))}
        </div>
      )}

      <FirmDialog
        open={creating || !!editing}
        firm={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
          if (params.get("edit")) router.replace("/settings/firms");
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          router.replace("/settings/firms");
          router.refresh();
        }}
      />
    </div>
  );
}

function FirmDialog({
  open,
  firm,
  onClose,
  onSaved,
}: {
  open: boolean;
  firm: FirmRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const empty = {
    name: "",
    gstin: "",
    stateCode: "32",
    addressLine1: "",
    addressLine2: "",
    city: "",
    pincode: "",
    phone: "",
    email: "",
    bankName: "",
    bankAccountNo: "",
    bankIfsc: "",
    upiId: "",
    termsAndConditions: "",
    isDefault: false,
  };

  const [values, setValues] = React.useState(empty);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setValues(
      firm
        ? {
            name: firm.name,
            gstin: firm.gstin ?? "",
            stateCode: firm.stateCode,
            addressLine1: firm.addressLine1 ?? "",
            addressLine2: firm.addressLine2 ?? "",
            city: firm.city ?? "",
            pincode: firm.pincode ?? "",
            phone: firm.phone ?? "",
            email: firm.email ?? "",
            bankName: firm.bankName ?? "",
            bankAccountNo: firm.bankAccountNo ?? "",
            bankIfsc: firm.bankIfsc ?? "",
            upiId: firm.upiId ?? "",
            termsAndConditions: firm.termsAndConditions ?? "",
            isDefault: firm.isDefault,
          }
        : empty,
    );
    setErrors({});
    setFormError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, firm]);

  function set(key: keyof typeof values, value: string | boolean) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  // The GSTIN carries its state.
  React.useEffect(() => {
    if (values.gstin.length === 15) {
      const result = validateGstin(values.gstin);
      if (result.valid && result.stateCode && result.stateCode !== values.stateCode) {
        set("stateCode", result.stateCode);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.gstin]);

  async function save() {
    setSaving(true);
    setErrors({});
    setFormError(null);

    const result = await saveFirmAction({ id: firm?.id, ...values });
    setSaving(false);

    if (!result.ok) {
      setFormError(result.error);
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(result.fieldErrors ?? {})) next[k] = v[0]!;
      setErrors(next);
      return;
    }

    toast.success(firm ? "Firm updated" : `${values.name} added`);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? null : onClose())}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{firm ? `Edit ${firm.name}` : "Add firm"}</DialogTitle>
          <DialogDescription>
            These details head every invoice this firm issues.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {formError ? (
            <p className="rounded-lg bg-[var(--color-negative-soft)] px-3 py-2 text-[13px] text-[var(--color-negative)]">
              {formError}
            </p>
          ) : null}

          <FormGrid>
            <Field id="name" label="Firm name" required error={errors.name} className="sm:col-span-2">
              <Input
                id="name"
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                autoFocus
                invalid={!!errors.name}
              />
            </Field>

            <Field id="gstin" label="GSTIN" error={errors.gstin}>
              <Input
                id="gstin"
                value={values.gstin}
                onChange={(e) => set("gstin", e.target.value.toUpperCase())}
                maxLength={15}
                className="uppercase"
                invalid={!!errors.gstin}
              />
            </Field>

            <Field id="stateCode" label="State" required error={errors.stateCode}>
              <Select value={values.stateCode} onValueChange={(v) => set("stateCode", v)}>
                <SelectTrigger id="stateCode" invalid={!!errors.stateCode}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INDIAN_STATES.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.code} — {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field id="phone" label="Phone" error={errors.phone}>
              <Input
                id="phone"
                value={values.phone}
                onChange={(e) => set("phone", e.target.value)}
                invalid={!!errors.phone}
              />
            </Field>

            <Field id="email" label="Email" error={errors.email}>
              <Input
                id="email"
                type="email"
                value={values.email}
                onChange={(e) => set("email", e.target.value)}
                invalid={!!errors.email}
              />
            </Field>

            <Field id="addressLine1" label="Address line 1" className="sm:col-span-2">
              <Input
                id="addressLine1"
                value={values.addressLine1}
                onChange={(e) => set("addressLine1", e.target.value)}
              />
            </Field>

            <Field id="city" label="City">
              <Input id="city" value={values.city} onChange={(e) => set("city", e.target.value)} />
            </Field>

            <Field id="pincode" label="PIN code">
              <Input
                id="pincode"
                value={values.pincode}
                onChange={(e) => set("pincode", e.target.value)}
                maxLength={6}
                inputMode="numeric"
              />
            </Field>
          </FormGrid>

          <div className="border-t border-[var(--border-subtle)] pt-5">
            <h3 className="mb-3 text-[13px] font-semibold">Bank details for invoices</h3>
            <FormGrid>
              <Field id="bankName" label="Bank">
                <Input
                  id="bankName"
                  value={values.bankName}
                  onChange={(e) => set("bankName", e.target.value)}
                />
              </Field>
              <Field id="bankAccountNo" label="Account number">
                <Input
                  id="bankAccountNo"
                  value={values.bankAccountNo}
                  onChange={(e) => set("bankAccountNo", e.target.value)}
                />
              </Field>
              <Field id="bankIfsc" label="IFSC">
                <Input
                  id="bankIfsc"
                  value={values.bankIfsc}
                  onChange={(e) => set("bankIfsc", e.target.value.toUpperCase())}
                  maxLength={11}
                />
              </Field>
              <Field id="upiId" label="UPI ID" hint="Encoded into the invoice payment QR.">
                <Input
                  id="upiId"
                  value={values.upiId}
                  onChange={(e) => set("upiId", e.target.value)}
                />
              </Field>
            </FormGrid>
          </div>

          <div className="border-t border-[var(--border-subtle)] pt-5">
            <Field id="termsAndConditions" label="Default terms & conditions">
              <Textarea
                id="termsAndConditions"
                rows={3}
                value={values.termsAndConditions}
                onChange={(e) => set("termsAndConditions", e.target.value)}
                placeholder="Thanks for doing business with us."
              />
            </Field>

            <label className="mt-4 flex items-center gap-2.5">
              <Checkbox
                checked={values.isDefault}
                onCheckedChange={(v) => set("isDefault", v === true)}
              />
              <span className="text-sm">Use this firm by default on new documents</span>
            </label>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={saving}>
            Save firm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

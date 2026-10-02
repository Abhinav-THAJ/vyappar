"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/controls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsListPills, TabsTriggerPill, TabsContent } from "@/components/ui/tabs";
import { Field, FormError } from "@/components/forms/form-field";
import { FormShell, FormSection, FormGrid } from "@/components/forms/form-shell";
import { INDIAN_STATES, validateGstin } from "@/lib/gst";
import {
  partySchema,
  PARTY_TYPES,
  GST_TYPES,
  GST_TYPE_LABELS,
  type PartyInput,
} from "@/lib/validators/party";
import { savePartyAction } from "@/server/actions/parties";

const PARTY_TYPE_LABELS: Record<(typeof PARTY_TYPES)[number], string> = {
  CUSTOMER: "Customer",
  SUPPLIER: "Supplier",
  BOTH: "Both",
};

export interface PartyFormDefaults extends Partial<PartyInput> {
  id?: string;
}

export function PartyForm({
  defaults,
  groups,
  enableCreditLimit,
  enableShippingAddress,
  enableGroups,
}: {
  defaults?: PartyFormDefaults;
  groups: { id: string; name: string }[];
  enableCreditLimit: boolean;
  enableShippingAddress: boolean;
  enableGroups: boolean;
}) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [sameAsBilling, setSameAsBilling] = React.useState(
    !defaults?.shippingAddress || defaults.shippingAddress === defaults.billingAddress,
  );

  const isEdit = !!defaults?.id;

  const form = useForm<PartyInput>({
    resolver: zodResolver(partySchema),
    defaultValues: {
      id: defaults?.id,
      name: defaults?.name ?? "",
      type: defaults?.type ?? "CUSTOMER",
      gstType: defaults?.gstType ?? "UNREGISTERED",
      gstin: defaults?.gstin,
      stateCode: defaults?.stateCode,
      phone: defaults?.phone,
      email: defaults?.email,
      billingAddress: defaults?.billingAddress,
      shippingAddress: defaults?.shippingAddress,
      partyGroupId: defaults?.partyGroupId,
      openingBalance: defaults?.openingBalance ?? "0",
      openingBalanceType: defaults?.openingBalanceType ?? "TO_RECEIVE",
      openingAsOf: defaults?.openingAsOf,
      creditLimit: defaults?.creditLimit,
      paymentTermDays: defaults?.paymentTermDays,
      customFields: defaults?.customFields ?? {},
    },
  });

  const { register, handleSubmit, watch, setValue, setError, formState } = form;
  const values = watch();

  // A GSTIN carries its state; fill it in rather than making the user match it.
  React.useEffect(() => {
    if (values.gstin && values.gstin.length === 15) {
      const result = validateGstin(values.gstin);
      if (result.valid && result.stateCode && result.stateCode !== values.stateCode) {
        setValue("stateCode", result.stateCode, { shouldValidate: true });
      }
    }
  }, [values.gstin, values.stateCode, setValue]);

  React.useEffect(() => {
    if (sameAsBilling) setValue("shippingAddress", values.billingAddress);
  }, [sameAsBilling, values.billingAddress, setValue]);

  async function onSubmit(input: PartyInput) {
    setFormError(null);
    const result = await savePartyAction(input);

    if (!result.ok) {
      setFormError(result.error);
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as keyof PartyInput, { message: messages[0] });
      }
      return;
    }

    toast.success(isEdit ? "Party updated" : `${input.name} added`);
    router.push(`/parties?id=${result.data.id}`);
    router.refresh();
  }

  const requiresGstin =
    values.gstType === "REGISTERED" || values.gstType === "COMPOSITION" || values.gstType === "SEZ";

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormShell
        title={isEdit ? `Edit ${defaults?.name ?? "party"}` : "Add Party"}
        description={isEdit ? undefined : "A customer, a supplier, or both."}
        onCancel={() => router.push("/parties")}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => router.push("/parties")}>
              Cancel
            </Button>
            <Button type="submit" loading={formState.isSubmitting}>
              {isEdit ? "Save changes" : "Save party"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormError message={formError} />

          <Tabs defaultValue="general">
            <TabsListPills className="mb-4">
              <TabsTriggerPill value="general">General</TabsTriggerPill>
              <TabsTriggerPill value="balance">Credit &amp; Balance</TabsTriggerPill>
              <TabsTriggerPill value="address">Address</TabsTriggerPill>
            </TabsListPills>

            <TabsContent value="general">
              <FormSection>
                <FormGrid>
                  <Field
                    id="name"
                    label="Party name"
                    required
                    error={formState.errors.name?.message}
                    className="sm:col-span-2"
                  >
                    <Input
                      id="name"
                      autoFocus
                      placeholder="Banerji Memorial Club"
                      invalid={!!formState.errors.name}
                      {...register("name")}
                    />
                  </Field>

                  <Field id="type" label="Party type" required>
                    <Select
                      value={values.type}
                      onValueChange={(v) => setValue("type", v as PartyInput["type"])}
                    >
                      <SelectTrigger id="type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PARTY_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {PARTY_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  {enableGroups ? (
                    <Field id="partyGroupId" label="Party group">
                      <Select
                        value={values.partyGroupId ?? "none"}
                        onValueChange={(v) =>
                          setValue("partyGroupId", v === "none" ? undefined : v)
                        }
                      >
                        <SelectTrigger id="partyGroupId">
                          <SelectValue placeholder="No group" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No group</SelectItem>
                          {groups.map((g) => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  ) : null}

                  <Field id="phone" label="Phone" error={formState.errors.phone?.message}>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="9847012345"
                      invalid={!!formState.errors.phone}
                      {...register("phone")}
                    />
                  </Field>

                  <Field id="email" label="Email" error={formState.errors.email?.message}>
                    <Input
                      id="email"
                      type="email"
                      invalid={!!formState.errors.email}
                      {...register("email")}
                    />
                  </Field>

                  <Field id="gstType" label="GST type" required>
                    <Select
                      value={values.gstType}
                      onValueChange={(v) => setValue("gstType", v as PartyInput["gstType"])}
                    >
                      <SelectTrigger id="gstType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GST_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {GST_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field
                    id="gstin"
                    label="GSTIN"
                    required={requiresGstin}
                    hint="The state fills in automatically."
                    error={formState.errors.gstin?.message}
                  >
                    <Input
                      id="gstin"
                      maxLength={15}
                      className="uppercase"
                      placeholder="32FNWPS9685D1Z1"
                      invalid={!!formState.errors.gstin}
                      {...register("gstin")}
                    />
                  </Field>

                  <Field
                    id="stateCode"
                    label="State"
                    hint="Decides CGST+SGST versus IGST on every invoice."
                    error={formState.errors.stateCode?.message}
                  >
                    <Select
                      value={values.stateCode ?? "none"}
                      onValueChange={(v) => setValue("stateCode", v === "none" ? undefined : v)}
                    >
                      <SelectTrigger id="stateCode" invalid={!!formState.errors.stateCode}>
                        <SelectValue placeholder="Not set" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not set</SelectItem>
                        {INDIAN_STATES.map((s) => (
                          <SelectItem key={s.code} value={s.code}>
                            {s.code} — {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </FormGrid>
              </FormSection>
            </TabsContent>

            <TabsContent value="balance">
              <FormSection
                title="Opening balance"
                description="What this party owed, or was owed, when you started using Bella Books."
              >
                <FormGrid cols={3}>
                  <Field
                    id="openingBalance"
                    label="Amount"
                    error={formState.errors.openingBalance?.message}
                  >
                    <Input
                      id="openingBalance"
                      inputMode="decimal"
                      invalid={!!formState.errors.openingBalance}
                      {...register("openingBalance")}
                    />
                  </Field>

                  <Field id="openingBalanceType" label="Direction">
                    <Select
                      value={values.openingBalanceType}
                      onValueChange={(v) =>
                        setValue("openingBalanceType", v as PartyInput["openingBalanceType"])
                      }
                    >
                      <SelectTrigger id="openingBalanceType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TO_RECEIVE">To receive</SelectItem>
                        <SelectItem value="TO_PAY">To pay</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field
                    id="openingAsOf"
                    label="As of"
                    error={formState.errors.openingAsOf?.message}
                  >
                    <Input
                      id="openingAsOf"
                      type="date"
                      invalid={!!formState.errors.openingAsOf}
                      {...register("openingAsOf")}
                    />
                  </Field>
                </FormGrid>
              </FormSection>

              <FormSection title="Terms" className="mt-4">
                <FormGrid>
                  {enableCreditLimit ? (
                    <Field
                      id="creditLimit"
                      label="Credit limit"
                      hint="Leave blank for no limit."
                      error={formState.errors.creditLimit?.message}
                    >
                      <Input id="creditLimit" inputMode="decimal" {...register("creditLimit")} />
                    </Field>
                  ) : null}

                  <Field
                    id="paymentTermDays"
                    label="Payment terms (days)"
                    hint="Sets the due date on new invoices."
                    error={formState.errors.paymentTermDays?.message}
                  >
                    <Input
                      id="paymentTermDays"
                      type="number"
                      min={0}
                      max={365}
                      {...register("paymentTermDays")}
                    />
                  </Field>
                </FormGrid>
              </FormSection>
            </TabsContent>

            <TabsContent value="address">
              <FormSection>
                <div className="space-y-4">
                  <Field id="billingAddress" label="Billing address">
                    <Textarea id="billingAddress" rows={3} {...register("billingAddress")} />
                  </Field>

                  {enableShippingAddress ? (
                    <>
                      <label className="flex items-center gap-2.5">
                        <Checkbox
                          checked={sameAsBilling}
                          onCheckedChange={(v) => setSameAsBilling(v === true)}
                        />
                        <span className="text-sm">Shipping address is the same as billing</span>
                      </label>

                      {!sameAsBilling ? (
                        <Field id="shippingAddress" label="Shipping address">
                          <Textarea
                            id="shippingAddress"
                            rows={3}
                            {...register("shippingAddress")}
                          />
                        </Field>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </FormSection>
            </TabsContent>
          </Tabs>
        </div>
      </FormShell>
    </form>
  );
}

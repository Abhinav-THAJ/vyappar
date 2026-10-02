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
import { itemSchema, type ItemInput } from "@/lib/validators/item";
import { saveItemAction } from "@/server/actions/items";

export interface ItemFormDefaults extends Partial<ItemInput> {
  id?: string;
}

export function ItemForm({
  defaults,
  units,
  categories,
  taxRates,
  settings,
}: {
  defaults?: ItemFormDefaults;
  units: { id: string; name: string; shortName: string }[];
  categories: { id: string; name: string }[];
  taxRates: { id: string; name: string; rate: string }[];
  settings: {
    maintainStock: boolean;
    enableUnits: boolean;
    enableCategories: boolean;
    enableWholesalePrice: boolean;
    enableItemCode: boolean;
    enableLowStockAlert: boolean;
  };
}) {
  const router = useRouter();
  const [formError, setFormError] = React.useState<string | null>(null);
  const isEdit = !!defaults?.id;

  const form = useForm<ItemInput>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      id: defaults?.id,
      name: defaults?.name ?? "",
      type: defaults?.type ?? "PRODUCT",
      sku: defaults?.sku,
      hsnSac: defaults?.hsnSac,
      description: defaults?.description,
      unitId: defaults?.unitId,
      secondaryUnitId: defaults?.secondaryUnitId,
      conversionFactor: defaults?.conversionFactor,
      salePrice: defaults?.salePrice ?? "0",
      salePriceTaxInclusive: defaults?.salePriceTaxInclusive ?? false,
      purchasePrice: defaults?.purchasePrice ?? "0",
      purchasePriceTaxInclusive: defaults?.purchasePriceTaxInclusive ?? false,
      wholesalePrice: defaults?.wholesalePrice,
      wholesaleMinQty: defaults?.wholesaleMinQty,
      taxRateId: defaults?.taxRateId,
      openingQty: defaults?.openingQty ?? "0",
      openingRate: defaults?.openingRate ?? "0",
      openingAsOf: defaults?.openingAsOf,
      minStockQty: defaults?.minStockQty ?? "0",
      location: defaults?.location,
      categoryIds: defaults?.categoryIds ?? [],
      isActive: defaults?.isActive ?? true,
    },
  });

  const { register, handleSubmit, watch, setValue, setError, formState } = form;
  const values = watch();
  const isProduct = values.type === "PRODUCT";

  async function onSubmit(input: ItemInput) {
    setFormError(null);
    const result = await saveItemAction(input);

    if (!result.ok) {
      setFormError(result.error);
      for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as keyof ItemInput, { message: messages[0] });
      }
      return;
    }

    toast.success(isEdit ? "Item updated" : `${input.name} added`);
    router.push(`/items?tab=${isProduct ? "products" : "services"}&id=${result.data.id}`);
    router.refresh();
  }

  function toggleCategory(id: string, on: boolean) {
    const next = new Set(values.categoryIds);
    if (on) next.add(id);
    else next.delete(id);
    setValue("categoryIds", [...next]);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormShell
        title={isEdit ? `Edit ${defaults?.name ?? "item"}` : "Add Item"}
        description={isEdit ? undefined : "A product you stock, or a service you bill for."}
        onCancel={() => router.push("/items")}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => router.push("/items")}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" loading={formState.isSubmitting}>
              {isEdit ? "Save changes" : "Save item"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormError message={formError} />

          <Tabs defaultValue="basic">
            <TabsListPills className="mb-4">
              <TabsTriggerPill value="basic">Basic</TabsTriggerPill>
              <TabsTriggerPill value="pricing">Pricing</TabsTriggerPill>
              {isProduct && settings.maintainStock ? (
                <TabsTriggerPill value="stock">Stock</TabsTriggerPill>
              ) : null}
            </TabsListPills>

            <TabsContent value="basic">
              <FormSection>
                <FormGrid>
                  <Field
                    id="name"
                    label="Item name"
                    required
                    error={formState.errors.name?.message}
                    className="sm:col-span-2"
                  >
                    <Input
                      id="name"
                      autoFocus
                      placeholder="10x10 Tent"
                      invalid={!!formState.errors.name}
                      {...register("name")}
                    />
                  </Field>

                  <Field id="type" label="Type" required>
                    <Select
                      value={values.type}
                      onValueChange={(v) => setValue("type", v as ItemInput["type"])}
                    >
                      <SelectTrigger id="type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PRODUCT">Product</SelectItem>
                        <SelectItem value="SERVICE">Service</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>

                  {settings.enableItemCode ? (
                    <Field id="sku" label="Item code / SKU">
                      <Input id="sku" {...register("sku")} />
                    </Field>
                  ) : null}

                  <Field
                    id="hsnSac"
                    label={isProduct ? "HSN code" : "SAC code"}
                    hint="4, 6 or 8 digits."
                    error={formState.errors.hsnSac?.message}
                  >
                    <Input
                      id="hsnSac"
                      inputMode="numeric"
                      maxLength={8}
                      invalid={!!formState.errors.hsnSac}
                      {...register("hsnSac")}
                    />
                  </Field>

                  {settings.enableUnits ? (
                    <Field id="unitId" label="Unit">
                      <Select
                        value={values.unitId ?? "none"}
                        onValueChange={(v) => setValue("unitId", v === "none" ? undefined : v)}
                      >
                        <SelectTrigger id="unitId">
                          <SelectValue placeholder="No unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No unit</SelectItem>
                          {units.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name} ({u.shortName})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  ) : null}

                  <Field
                    id="description"
                    label="Description"
                    className="sm:col-span-2"
                  >
                    <Textarea id="description" rows={2} {...register("description")} />
                  </Field>
                </FormGrid>

                {settings.enableCategories && categories.length > 0 ? (
                  <div className="mt-5">
                    <div className="mb-2 text-[13px] font-medium text-[var(--text-secondary)]">
                      Categories
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((c) => {
                        const on = values.categoryIds.includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--border-strong)] px-3 py-1.5 text-[13px]"
                          >
                            <Checkbox
                              checked={on}
                              onCheckedChange={(v) => toggleCategory(c.id, v === true)}
                              className="size-4"
                            />
                            {c.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </FormSection>
            </TabsContent>

            <TabsContent value="pricing">
              <FormSection
                title="Prices"
                description="Each price carries its own tax-inclusive flag, so a sale price can include GST while the purchase price excludes it."
              >
                <FormGrid>
                  <Field
                    id="salePrice"
                    label="Sale price"
                    error={formState.errors.salePrice?.message}
                  >
                    <Input id="salePrice" inputMode="decimal" {...register("salePrice")} />
                  </Field>

                  <div className="flex items-end pb-2">
                    <label className="flex cursor-pointer items-center gap-2.5">
                      <Checkbox
                        checked={values.salePriceTaxInclusive}
                        onCheckedChange={(v) => setValue("salePriceTaxInclusive", v === true)}
                      />
                      <span className="text-sm">Sale price includes tax</span>
                    </label>
                  </div>

                  <Field
                    id="purchasePrice"
                    label="Purchase price"
                    error={formState.errors.purchasePrice?.message}
                  >
                    <Input id="purchasePrice" inputMode="decimal" {...register("purchasePrice")} />
                  </Field>

                  <div className="flex items-end pb-2">
                    <label className="flex cursor-pointer items-center gap-2.5">
                      <Checkbox
                        checked={values.purchasePriceTaxInclusive}
                        onCheckedChange={(v) => setValue("purchasePriceTaxInclusive", v === true)}
                      />
                      <span className="text-sm">Purchase price includes tax</span>
                    </label>
                  </div>

                  {settings.enableWholesalePrice ? (
                    <>
                      <Field id="wholesalePrice" label="Wholesale price">
                        <Input
                          id="wholesalePrice"
                          inputMode="decimal"
                          {...register("wholesalePrice")}
                        />
                      </Field>
                      <Field id="wholesaleMinQty" label="Minimum wholesale quantity">
                        <Input
                          id="wholesaleMinQty"
                          inputMode="decimal"
                          {...register("wholesaleMinQty")}
                        />
                      </Field>
                    </>
                  ) : null}

                  <Field id="taxRateId" label="Tax rate" className="sm:col-span-2">
                    <Select
                      value={values.taxRateId ?? "none"}
                      onValueChange={(v) => setValue("taxRateId", v === "none" ? undefined : v)}
                    >
                      <SelectTrigger id="taxRateId">
                        <SelectValue placeholder="No tax" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No tax</SelectItem>
                        {taxRates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </FormGrid>
              </FormSection>
            </TabsContent>

            {isProduct && settings.maintainStock ? (
              <TabsContent value="stock">
                <FormSection
                  title="Opening stock"
                  description="What you held when you started using Bella Books. Later changes come from purchases, sales and adjustments."
                >
                  <FormGrid cols={3}>
                    <Field
                      id="openingQty"
                      label="Quantity"
                      error={formState.errors.openingQty?.message}
                    >
                      <Input
                        id="openingQty"
                        inputMode="decimal"
                        invalid={!!formState.errors.openingQty}
                        {...register("openingQty")}
                      />
                    </Field>
                    <Field id="openingRate" label="At price">
                      <Input id="openingRate" inputMode="decimal" {...register("openingRate")} />
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

                <FormSection title="Stock control" className="mt-4">
                  <FormGrid>
                    {settings.enableLowStockAlert ? (
                      <Field
                        id="minStockQty"
                        label="Minimum stock to maintain"
                        hint="Drives the low-stock alert on the dashboard."
                      >
                        <Input id="minStockQty" inputMode="decimal" {...register("minStockQty")} />
                      </Field>
                    ) : null}
                    <Field id="location" label="Item location">
                      <Input id="location" placeholder="Rack 3, Godown A" {...register("location")} />
                    </Field>
                  </FormGrid>
                </FormSection>
              </TabsContent>
            ) : null}
          </Tabs>
        </div>
      </FormShell>
    </form>
  );
}

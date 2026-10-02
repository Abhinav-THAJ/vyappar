import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getItem } from "@/server/services/items";
import { loadItemFormData } from "../../item-form-data";
import { ItemForm } from "../../item-form";

export const metadata: Metadata = { title: "Edit Item" };

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx, units, categories, taxRates, settings } = await loadItemFormData();

  const item = await getItem(ctx.companyId, id);
  if (!item) notFound();

  // Opening stock is represented by its own movement row, so the form shows a
  // zero here and the real level is changed through Adjust Item instead.
  return (
    <ItemForm
      units={units}
      categories={categories}
      taxRates={taxRates}
      settings={settings}
      defaults={{
        id: item.id,
        name: item.name,
        type: item.type,
        sku: item.sku ?? undefined,
        hsnSac: item.hsnSac ?? undefined,
        description: item.description ?? undefined,
        salePrice: item.salePrice,
        salePriceTaxInclusive: item.salePriceTaxInclusive,
        purchasePrice: item.purchasePrice,
        purchasePriceTaxInclusive: item.purchasePriceTaxInclusive,
        wholesalePrice: item.wholesalePrice ?? undefined,
        wholesaleMinQty: item.wholesaleMinQty ?? undefined,
        unitId: item.unitId ?? undefined,
        secondaryUnitId: item.secondaryUnitId ?? undefined,
        conversionFactor: item.conversionFactor ?? undefined,
        taxRateId: item.taxRateId ?? undefined,
        minStockQty: item.minStockQty,
        location: item.location ?? undefined,
        categoryIds: item.categories.map((c) => c.id),
        isActive: item.isActive,
      }}
    />
  );
}

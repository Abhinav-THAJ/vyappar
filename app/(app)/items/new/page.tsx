import type { Metadata } from "next";
import { loadItemFormData } from "../item-form-data";
import { ItemForm } from "../item-form";

export const metadata: Metadata = { title: "Add Item" };

export default async function NewItemPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const { units, categories, taxRates, settings } = await loadItemFormData();

  return (
    <ItemForm
      units={units}
      categories={categories}
      taxRates={taxRates}
      settings={settings}
      defaults={{ type: type === "SERVICE" ? "SERVICE" : "PRODUCT" }}
    />
  );
}

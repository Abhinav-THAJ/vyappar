import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import { getItem } from "@/server/services/items";
import { AdjustStockForm } from "./adjust-form";

export const metadata: Metadata = { title: "Adjust Item" };

export default async function AdjustItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("item.write");

  const item = await getItem(ctx.companyId, id);
  if (!item || item.type === "SERVICE") notFound();

  return (
    <AdjustStockForm
      item={{
        id: item.id,
        name: item.name,
        qty: item.qty ?? "0",
        unitShort: item.unitShort,
        purchasePrice: item.purchasePrice,
      }}
    />
  );
}

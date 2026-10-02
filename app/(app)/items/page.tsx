import type { Metadata } from "next";
import { requireCompany } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listItems, getItem, listItemCategories, listUnits } from "@/server/services/items";
import { itemTransactions } from "@/server/services/transactions";
import { ItemsScreen } from "./items-screen";

export const metadata: Metadata = { title: "Items" };

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireCompany();
  const params = await searchParams;

  const tab = typeof params.tab === "string" ? params.tab : "products";
  const selectedId = typeof params.id === "string" ? params.id : undefined;

  const [products, services, categories, units] = await Promise.all([
    listItems(ctx.companyId, { type: "PRODUCT" }),
    listItems(ctx.companyId, { type: "SERVICE" }),
    listItemCategories(ctx.companyId),
    listUnits(ctx.companyId),
  ]);

  const visible = tab === "services" ? services : products;
  const activeId = selectedId ?? visible[0]?.id;

  const [detail, transactions] = activeId
    ? await Promise.all([
        getItem(ctx.companyId, activeId),
        itemTransactions(ctx.companyId, activeId),
      ])
    : [null, []];

  return (
    <ItemsScreen
      tab={tab}
      products={products}
      services={services}
      categories={categories}
      units={units}
      detail={detail}
      transactions={transactions}
      canWrite={can(ctx.role, "item.write")}
    />
  );
}

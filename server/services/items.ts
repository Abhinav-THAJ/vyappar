import type { ItemType } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { stockLevels } from "./balances";
import { d } from "@/lib/calc";

export interface ItemListRow {
  id: string;
  name: string;
  type: ItemType;
  sku: string | null;
  hsnSac: string | null;
  salePrice: string;
  salePriceTaxInclusive: boolean;
  /** Stock on hand, summed from movements. Services report null. */
  qty: string | null;
  minStockQty: string;
  isLow: boolean;
}

/** The item master list (ref-03). */
export async function listItems(
  companyId: string,
  options: { q?: string; type?: ItemType; categoryId?: string | null } = {},
): Promise<ItemListRow[]> {
  const items = await prisma.item.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...(options.type ? { type: options.type } : {}),
      ...(options.categoryId
        ? { categories: { some: { categoryId: options.categoryId } } }
        : {}),
      ...(options.q
        ? {
            OR: [
              { name: { contains: options.q, mode: "insensitive" as const } },
              { sku: { contains: options.q, mode: "insensitive" as const } },
              { hsnSac: { contains: options.q } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      type: true,
      sku: true,
      hsnSac: true,
      salePrice: true,
      salePriceTaxInclusive: true,
      minStockQty: true,
    },
  });

  const products = items.filter((i) => i.type === "PRODUCT");
  const levels = await stockLevels(
    companyId,
    products.map((p) => p.id),
  );

  return items.map((item) => {
    const onHand = item.type === "PRODUCT" ? (levels.get(item.id) ?? new Decimal(0)) : null;
    const minQty = d(item.minStockQty.toString());

    return {
      id: item.id,
      name: item.name,
      type: item.type,
      sku: item.sku,
      hsnSac: item.hsnSac,
      salePrice: item.salePrice.toFixed(2),
      salePriceTaxInclusive: item.salePriceTaxInclusive,
      qty: onHand ? onHand.toFixed(3) : null,
      minStockQty: minQty.toFixed(3),
      isLow: onHand ? onHand.lessThanOrEqualTo(minQty) : false,
    };
  });
}

/** Item detail for the right-hand pane, with stock value. */
export async function getItem(companyId: string, itemId: string) {
  const item = await prisma.item.findFirst({
    where: { id: itemId, companyId, deletedAt: null },
    select: {
      id: true,
      name: true,
      type: true,
      sku: true,
      hsnSac: true,
      description: true,
      salePrice: true,
      salePriceTaxInclusive: true,
      purchasePrice: true,
      purchasePriceTaxInclusive: true,
      wholesalePrice: true,
      wholesaleMinQty: true,
      minStockQty: true,
      location: true,
      isActive: true,
      // The ids matter: the edit form round-trips them, and omitting them
      // would silently clear the item's unit and tax rate on every save.
      unitId: true,
      secondaryUnitId: true,
      conversionFactor: true,
      taxRateId: true,
      unit: { select: { shortName: true, name: true } },
      taxRate: { select: { name: true, rate: true } },
      categories: { select: { category: { select: { id: true, name: true } } } },
    },
  });

  if (!item) return null;

  const levels = item.type === "PRODUCT" ? await stockLevels(companyId, [itemId]) : null;
  const onHand = levels?.get(itemId) ?? null;

  // Stock value at purchase price — the basis shown on the item card.
  const stockValue = onHand ? onHand.times(d(item.purchasePrice.toString())) : null;

  return {
    id: item.id,
    name: item.name,
    type: item.type,
    sku: item.sku,
    hsnSac: item.hsnSac,
    description: item.description,
    salePrice: item.salePrice.toFixed(2),
    salePriceTaxInclusive: item.salePriceTaxInclusive,
    purchasePrice: item.purchasePrice.toFixed(2),
    purchasePriceTaxInclusive: item.purchasePriceTaxInclusive,
    wholesalePrice: item.wholesalePrice?.toFixed(2) ?? null,
    wholesaleMinQty: item.wholesaleMinQty?.toFixed(3) ?? null,
    minStockQty: item.minStockQty.toFixed(3),
    location: item.location,
    isActive: item.isActive,
    unitId: item.unitId,
    secondaryUnitId: item.secondaryUnitId,
    conversionFactor: item.conversionFactor?.toFixed(3) ?? null,
    taxRateId: item.taxRateId,
    unitShort: item.unit?.shortName ?? null,
    taxRateName: item.taxRate?.name ?? null,
    taxRateValue: item.taxRate?.rate.toString() ?? null,
    categories: item.categories.map((c) => c.category),
    qty: onHand ? onHand.toFixed(3) : null,
    stockValue: stockValue ? stockValue.toFixed(2) : null,
    isLow: onHand ? onHand.lessThanOrEqualTo(d(item.minStockQty.toString())) : false,
  };
}

export type ItemDetail = NonNullable<Awaited<ReturnType<typeof getItem>>>;

/** Categories and units, for the tabs beside PRODUCTS and SERVICES. */
export async function listItemCategories(companyId: string) {
  const categories = await prisma.itemCategory.findMany({
    where: { companyId, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { items: true } } },
  });

  return categories.map((c) => ({ id: c.id, name: c.name, itemCount: c._count.items }));
}

export async function listUnits(companyId: string) {
  return prisma.unit.findMany({
    where: { companyId, deletedAt: null },
    orderBy: { shortName: "asc" },
    select: { id: true, name: true, shortName: true },
  });
}

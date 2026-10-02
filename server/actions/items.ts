"use server";

import { revalidatePath } from "next/cache";
import { StockReason } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import {
  itemSchema,
  stockAdjustSchema,
  itemCategorySchema,
  unitSchema,
  deleteItemSchema,
} from "@/lib/validators/item";
import { normalizeName } from "@/lib/utils";
import { parseDateInput, todayIST } from "@/lib/format/date";
import { writeAudit } from "@/server/services/audit";
import { stockOnHand } from "@/server/services/posting";
import { runAction, BusinessError, type ActionResult } from "@/server/guards/action";

/** Create or update an item, including its opening-stock movement. */
export async function saveItemAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(itemSchema, raw, async (input) => {
    const ctx = await requirePermission("item.write");
    const nameNormalized = normalizeName(input.name);

    const duplicate = await ctx.db.item.findFirst({
      where: { nameNormalized, ...(input.id ? { id: { not: input.id } } : {}) },
      select: { id: true },
    });
    if (duplicate) {
      throw new BusinessError("An item with that name already exists", {
        name: ["An item with that name already exists"],
      });
    }

    const openingAsOf = input.openingAsOf ? parseDateInput(input.openingAsOf) : null;

    const data = {
      name: input.name,
      nameNormalized,
      type: input.type,
      sku: input.sku ?? null,
      hsnSac: input.hsnSac ?? null,
      description: input.description ?? null,
      unitId: input.unitId ?? null,
      secondaryUnitId: input.secondaryUnitId ?? null,
      conversionFactor: input.conversionFactor ?? null,
      salePrice: input.salePrice,
      salePriceTaxInclusive: input.salePriceTaxInclusive,
      purchasePrice: input.purchasePrice,
      purchasePriceTaxInclusive: input.purchasePriceTaxInclusive,
      wholesalePrice: input.wholesalePrice ?? null,
      wholesaleMinQty: input.wholesaleMinQty ?? null,
      taxRateId: input.taxRateId ?? null,
      openingQty: input.openingQty,
      openingRate: input.openingRate,
      openingAsOf,
      minStockQty: input.minStockQty,
      location: input.location ?? null,
      isActive: input.isActive,
    };

    const id = await prisma.$transaction(async (tx) => {
      let itemId: string;

      if (input.id) {
        const existing = await tx.item.findFirst({
          where: { id: input.id, companyId: ctx.companyId, deletedAt: null },
          select: { id: true },
        });
        if (!existing) throw new BusinessError("That item no longer exists");

        await tx.item.update({ where: { id: existing.id }, data });
        itemId = existing.id;

        // Replace the opening movement rather than adding another.
        await tx.stockMovement.deleteMany({
          where: { companyId: ctx.companyId, itemId, reason: StockReason.OPENING },
        });
      } else {
        const created = await tx.item.create({
          data: { ...data, companyId: ctx.companyId, createdById: ctx.user.id },
          select: { id: true },
        });
        itemId = created.id;
      }

      // Categories are a full replace, which keeps the form simple.
      await tx.itemCategoryOnItem.deleteMany({ where: { itemId } });
      if (input.categoryIds.length > 0) {
        await tx.itemCategoryOnItem.createMany({
          data: input.categoryIds.map((categoryId) => ({ itemId, categoryId })),
          skipDuplicates: true,
        });
      }

      if (input.type === "PRODUCT" && Number(input.openingQty) !== 0) {
        const qty = Number(input.openingQty);
        await tx.stockMovement.create({
          data: {
            companyId: ctx.companyId,
            itemId,
            date: openingAsOf ?? todayIST(),
            qtyIn: qty > 0 ? Math.abs(qty).toFixed(3) : "0",
            qtyOut: qty < 0 ? Math.abs(qty).toFixed(3) : "0",
            rate: input.openingRate,
            reason: StockReason.OPENING,
            note: "Opening stock",
          },
        });
      }

      return itemId;
    });

    await writeAudit(ctx, {
      entity: "Item",
      entityId: id,
      action: input.id ? "UPDATE" : "CREATE",
      after: data,
    });

    revalidatePath("/items");
    return { id };
  });
}

/** The Adjust Item dialog — writes a StockMovement, never a stored counter (D-06). */
export async function adjustStockAction(raw: unknown): Promise<ActionResult<{ onHand: string }>> {
  return runAction(stockAdjustSchema, raw, async (input) => {
    const ctx = await requirePermission("item.write");

    const item = await ctx.db.item.findFirst({
      where: { id: input.itemId },
      select: { id: true, name: true, type: true },
    });
    if (!item) throw new BusinessError("That item no longer exists");
    if (item.type === "SERVICE") {
      throw new BusinessError("A service does not hold stock and cannot be adjusted");
    }

    const date = parseDateInput(input.date) ?? todayIST();
    const isAdd = input.direction === "ADD";

    const onHand = await prisma.$transaction(async (tx) => {
      await tx.stockMovement.create({
        data: {
          companyId: ctx.companyId,
          itemId: input.itemId,
          date,
          qtyIn: isAdd ? input.qty : "0",
          qtyOut: isAdd ? "0" : input.qty,
          rate: input.rate,
          reason: isAdd ? StockReason.ADJUSTMENT_ADD : StockReason.ADJUSTMENT_REDUCE,
          note: input.note ?? null,
        },
      });

      return stockOnHand(tx, ctx.companyId, input.itemId);
    });

    await writeAudit(ctx, {
      entity: "Item",
      entityId: input.itemId,
      action: "UPDATE",
      after: { adjustment: input },
    });

    revalidatePath("/items");
    return { onHand: onHand.toFixed(3) };
  });
}

/** Soft-delete an item, unless it has been used. */
export async function deleteItemAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(deleteItemSchema, raw, async ({ id }) => {
    const ctx = await requirePermission("item.write");

    const lineCount = await ctx.db.transactionLine.count({ where: { itemId: id } });
    if (lineCount > 0) {
      throw new BusinessError(
        `This item appears on ${lineCount} transaction line${lineCount === 1 ? "" : "s"} and cannot be deleted.`,
      );
    }

    await ctx.db.item.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAudit(ctx, { entity: "Item", entityId: id, action: "DELETE" });

    revalidatePath("/items");
    return { id };
  });
}

export async function saveItemCategoryAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(itemCategorySchema, raw, async (input) => {
    const ctx = await requirePermission("item.write");
    const id = input.id
      ? (await ctx.db.itemCategory.update({ where: { id: input.id }, data: { name: input.name } })).id
      : (await ctx.db.itemCategory.create({ data: { companyId: ctx.companyId, name: input.name }, select: { id: true } })).id;
    revalidatePath("/items");
    return { id };
  });
}

export async function deleteItemCategoryAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(deleteItemSchema, raw, async ({ id }) => {
    const ctx = await requirePermission("item.write");
    await ctx.db.itemCategory.update({ where: { id }, data: { deletedAt: new Date() } });
    revalidatePath("/items");
    return { id };
  });
}

export async function saveUnitAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(unitSchema, raw, async (input) => {
    const ctx = await requirePermission("item.write");

    const duplicate = await ctx.db.unit.findFirst({
      where: { shortName: input.shortName, ...(input.id ? { id: { not: input.id } } : {}) },
      select: { id: true },
    });
    if (duplicate) {
      throw new BusinessError("A unit with that short name already exists", {
        shortName: ["A unit with that short name already exists"],
      });
    }

    const data = { companyId: ctx.companyId, name: input.name, shortName: input.shortName };
    const id = input.id
      ? (await ctx.db.unit.update({ where: { id: input.id }, data })).id
      : (await ctx.db.unit.create({ data, select: { id: true } })).id;

    revalidatePath("/items");
    return { id };
  });
}

export async function deleteUnitAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(deleteItemSchema, raw, async ({ id }) => {
    const ctx = await requirePermission("item.write");

    const inUse = await ctx.db.item.count({ where: { unitId: id } });
    if (inUse > 0) {
      throw new BusinessError(`${inUse} item${inUse === 1 ? " uses" : "s use"} this unit.`);
    }

    await ctx.db.unit.update({ where: { id }, data: { deletedAt: new Date() } });
    revalidatePath("/items");
    return { id };
  });
}

/** Item picker search for the transaction forms. */
export async function searchItemsAction(query: string) {
  const ctx = await requirePermission("item.read");

  const items = await ctx.db.item.findMany({
    where: {
      isActive: true,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" as const } },
              { sku: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
    take: 25,
    select: {
      id: true,
      name: true,
      type: true,
      sku: true,
      hsnSac: true,
      salePrice: true,
      salePriceTaxInclusive: true,
      purchasePrice: true,
      purchasePriceTaxInclusive: true,
      unitId: true,
      taxRateId: true,
      taxRate: { select: { rate: true, cessRate: true } },
      unit: { select: { shortName: true } },
    },
  });

  return items.map((i) => ({
    id: i.id,
    name: i.name,
    type: i.type,
    sku: i.sku,
    hsnSac: i.hsnSac,
    salePrice: i.salePrice.toFixed(2),
    salePriceTaxInclusive: i.salePriceTaxInclusive,
    purchasePrice: i.purchasePrice.toFixed(2),
    purchasePriceTaxInclusive: i.purchasePriceTaxInclusive,
    unitId: i.unitId,
    unitShort: i.unit?.shortName ?? null,
    taxRateId: i.taxRateId,
    taxRateValue: i.taxRate?.rate.toString() ?? "0",
    cessRate: i.taxRate?.cessRate.toString() ?? "0",
  }));
}

export type ItemPickerRow = Awaited<ReturnType<typeof searchItemsAction>>[number];

/** Create an item inline from a transaction form. */
export async function quickCreateItemAction(
  raw: unknown,
): Promise<ActionResult<{ id: string; name: string }>> {
  return runAction(itemSchema, raw, async (input) => {
    const ctx = await requirePermission("item.write");
    const nameNormalized = normalizeName(input.name);

    const duplicate = await ctx.db.item.findFirst({
      where: { nameNormalized },
      select: { id: true, name: true },
    });
    if (duplicate) return duplicate;

    const created = await ctx.db.item.create({
      data: {
        companyId: ctx.companyId,
        name: input.name,
        nameNormalized,
        type: input.type,
        hsnSac: input.hsnSac ?? null,
        unitId: input.unitId ?? null,
        salePrice: input.salePrice,
        salePriceTaxInclusive: input.salePriceTaxInclusive,
        purchasePrice: input.purchasePrice,
        taxRateId: input.taxRateId ?? null,
        createdById: ctx.user.id,
      },
      select: { id: true, name: true },
    });

    revalidatePath("/items");
    return created;
  });
}

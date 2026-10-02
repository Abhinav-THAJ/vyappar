import { z } from "zod";
import {
  zRequiredString,
  zOptionalString,
  zMoney,
  zQty,
  zHsnSac,
  zDateInputOptional,
  zCuidOptional,
} from "./common";

export const ITEM_TYPES = ["PRODUCT", "SERVICE"] as const;

export const itemSchema = z
  .object({
    id: zCuidOptional,
    name: zRequiredString("Item name", 200),
    type: z.enum(ITEM_TYPES).default("PRODUCT"),
    sku: zOptionalString,
    hsnSac: zHsnSac,
    description: zOptionalString,

    unitId: zCuidOptional,
    secondaryUnitId: zCuidOptional,
    conversionFactor: zQty.optional(),

    salePrice: zMoney.default("0"),
    salePriceTaxInclusive: z.boolean().default(false),
    purchasePrice: zMoney.default("0"),
    purchasePriceTaxInclusive: z.boolean().default(false),
    wholesalePrice: zMoney.optional(),
    wholesaleMinQty: zQty.optional(),

    taxRateId: zCuidOptional,

    openingQty: zQty.default("0"),
    openingRate: zMoney.default("0"),
    openingAsOf: zDateInputOptional,
    minStockQty: zQty.default("0"),
    location: zOptionalString,

    categoryIds: z.array(z.string()).default([]),
    isActive: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.secondaryUnitId && !value.conversionFactor) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["conversionFactor"],
        message: "A secondary unit needs a conversion factor",
      });
    }
    if (value.secondaryUnitId && value.secondaryUnitId === value.unitId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["secondaryUnitId"],
        message: "The secondary unit must differ from the primary unit",
      });
    }
    if (Number(value.openingQty) !== 0 && !value.openingAsOf) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["openingAsOf"],
        message: "Opening stock needs an as-of date",
      });
    }
    // Services carry no stock at all.
    if (value.type === "SERVICE" && Number(value.openingQty) !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["openingQty"],
        message: "A service cannot hold stock",
      });
    }
  });

export type ItemInput = z.infer<typeof itemSchema>;

/** Adjust Item — the dialog behind the button in ref-03. */
export const stockAdjustSchema = z.object({
  itemId: z.string().min(1),
  direction: z.enum(["ADD", "REDUCE"]),
  qty: zQty.refine((v) => Number(v) > 0, "Quantity must be greater than zero"),
  rate: zMoney.default("0"),
  date: z.string().min(1, "Choose a date"),
  note: zOptionalString,
});

export type StockAdjustInput = z.infer<typeof stockAdjustSchema>;

export const itemCategorySchema = z.object({
  id: zCuidOptional,
  name: zRequiredString("Category name", 80),
});

export const unitSchema = z.object({
  id: zCuidOptional,
  name: zRequiredString("Unit name", 60),
  shortName: zRequiredString("Short name", 12),
});

export const deleteItemSchema = z.object({ id: z.string().min(1) });

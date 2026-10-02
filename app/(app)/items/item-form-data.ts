import { requirePermission } from "@/lib/auth/session";
import { parseSettings } from "@/lib/validators/settings";

const SETTINGS_SELECT = {
  general: true,
  transaction: true,
  print: true,
  tax: true,
  party: true,
  item: true,
  message: true,
} as const;

/** Everything the item form needs besides the item itself. */
export async function loadItemFormData() {
  const ctx = await requirePermission("item.write");

  const [units, categories, taxRates, settingsRow] = await Promise.all([
    ctx.db.unit.findMany({
      orderBy: { shortName: "asc" },
      select: { id: true, name: true, shortName: true },
    }),
    ctx.db.itemCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ctx.db.taxRate.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, rate: true },
    }),
    ctx.db.settings.findFirst({ where: { companyId: ctx.companyId }, select: SETTINGS_SELECT }),
  ]);

  const settings = parseSettings(settingsRow);

  return {
    ctx,
    units,
    categories,
    taxRates: taxRates.map((t) => ({ id: t.id, name: t.name, rate: t.rate.toString() })),
    settings: {
      maintainStock: settings.item.maintainStock,
      enableUnits: settings.item.enableUnits,
      enableCategories: settings.item.enableCategories,
      enableWholesalePrice: settings.item.enableWholesalePrice,
      enableItemCode: settings.item.enableItemCode,
      enableLowStockAlert: settings.item.enableLowStockAlert,
    },
  };
}

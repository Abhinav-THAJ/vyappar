import { z } from "zod";

/**
 * Settings, one Zod object per tab of the Settings overlay (ref-11).
 * Stored as JSON columns and validated on read and write, so a partially
 * written or hand-edited blob can never crash a page — `parseSettings` fills
 * in defaults for anything missing.
 */

/* ------------------------------- GENERAL --------------------------------- */

export const generalSettingsSchema = z.object({
  enablePasscode: z.boolean().default(false),
  businessCurrency: z.string().default("INR"),
  decimalPlaces: z.number().int().min(0).max(4).default(2),
  showGstinNumber: z.boolean().default(true),
  stopSaleOnNegativeStock: z.boolean().default(false),
  blockNewItemsFromTxnForm: z.boolean().default(false),
  blockNewPartiesFromTxnForm: z.boolean().default(false),

  // "More Transactions" — these toggles show and hide whole sidebar sections.
  enableEstimate: z.boolean().default(true),
  enableProforma: z.boolean().default(true),
  enableOrders: z.boolean().default(true),
  enableOtherIncome: z.boolean().default(false),
  enableFixedAssets: z.boolean().default(false),
  enableDeliveryChallan: z.boolean().default(true),
  goodsReturnOnDeliveryChallan: z.boolean().default(true),
  printAmountInDeliveryChallan: z.boolean().default(false),

  // Backup & History
  autoBackup: z.boolean().default(false),
  auditTrail: z.boolean().default(true),

  /** Screen zoom, 70-130 in ten-point steps (A-26). */
  screenZoom: z.number().int().min(70).max(130).default(100),
  theme: z.enum(["light", "dark", "system"]).default("system"),
});

/* ----------------------------- TRANSACTION -------------------------------- */

export const transactionSettingsSchema = z.object({
  defaultDueDays: z.number().int().min(0).max(365).default(30),
  resetNumberingYearly: z.boolean().default(true),

  showLineDiscount: z.boolean().default(true),
  showFreeQuantity: z.boolean().default(false),
  showLineDescription: z.boolean().default(true),
  showAdditionalCharges: z.boolean().default(true),
  showBillDiscount: z.boolean().default(true),

  roundOffEnabled: z.boolean().default(true),
  roundOffMode: z.enum(["nearest", "up", "down"]).default("nearest"),

  /** Default price basis for new lines. */
  defaultTaxInclusive: z.boolean().default(false),
});

/* -------------------------------- PRINT ----------------------------------- */

export const printSettingsSchema = z.object({
  theme: z.enum(["classic", "modern", "compact"]).default("classic"),
  paperSize: z.enum(["A4", "A5", "thermal80", "thermal58"]).default("A4"),
  showLogo: z.boolean().default(true),
  showSignature: z.boolean().default(true),
  showBankDetails: z.boolean().default(true),
  showUpiQr: z.boolean().default(false),
  showTerms: z.boolean().default(true),
  showAmountInWords: z.boolean().default(true),
  showHsnSummary: z.boolean().default(true),
  showPartyBalance: z.boolean().default(false),
  showCopyLabel: z.boolean().default(false),
  copyLabels: z.array(z.string()).default(["Original", "Duplicate", "Triplicate"]),
});

/* ------------------------------ TAXES & GST -------------------------------- */

export const taxSettingsSchema = z.object({
  enableGst: z.boolean().default(true),
  compositionScheme: z.boolean().default(false),
  enableCess: z.boolean().default(false),
  enableTcs: z.boolean().default(false),
  defaultTcsRate: z.number().min(0).max(100).default(0),
  enableHsn: z.boolean().default(true),
  enableReverseCharge: z.boolean().default(false),
});

/* -------------------------------- PARTY ------------------------------------ */

export const partySettingsSchema = z.object({
  enablePartyGroups: z.boolean().default(true),
  enableCreditLimit: z.boolean().default(false),
  enableShippingAddress: z.boolean().default(true),
  enablePaymentTerms: z.boolean().default(true),
  customFieldLabels: z.array(z.string()).max(4).default([]),
});

/* --------------------------------- ITEM ------------------------------------ */

export const itemSettingsSchema = z.object({
  maintainStock: z.boolean().default(true),
  enableUnits: z.boolean().default(true),
  enableCategories: z.boolean().default(true),
  enableWholesalePrice: z.boolean().default(false),
  enableLowStockAlert: z.boolean().default(true),
  enableItemImages: z.boolean().default(true),
  enableItemCode: z.boolean().default(true),
  customFieldLabels: z.array(z.string()).max(3).default([]),
});

/* ------------------------- TRANSACTION MESSAGE ----------------------------- */

export const messageSettingsSchema = z.object({
  sendOnSave: z.boolean().default(false),
  saleTemplate: z
    .string()
    .default(
      "Hi {party}, thank you for your business. Invoice {number} for {amount} is ready. Balance due: {balance}.",
    ),
  paymentTemplate: z
    .string()
    .default("Hi {party}, we have received {amount} against invoice {number}. Thank you."),
  reminderTemplate: z
    .string()
    .default("Hi {party}, a gentle reminder that {balance} is outstanding on invoice {number}."),
});

/* -------------------------------- bundle ---------------------------------- */

export const settingsSchema = z.object({
  general: generalSettingsSchema,
  transaction: transactionSettingsSchema,
  print: printSettingsSchema,
  tax: taxSettingsSchema,
  party: partySettingsSchema,
  item: itemSettingsSchema,
  message: messageSettingsSchema,
});

export type GeneralSettings = z.infer<typeof generalSettingsSchema>;
export type TransactionSettings = z.infer<typeof transactionSettingsSchema>;
export type PrintSettings = z.infer<typeof printSettingsSchema>;
export type TaxSettings = z.infer<typeof taxSettingsSchema>;
export type PartySettings = z.infer<typeof partySettingsSchema>;
export type ItemSettings = z.infer<typeof itemSettingsSchema>;
export type MessageSettings = z.infer<typeof messageSettingsSchema>;
export type AppSettings = z.infer<typeof settingsSchema>;

export const SETTINGS_TABS = [
  "general",
  "transaction",
  "print",
  "tax",
  "party",
  "item",
  "message",
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

const TAB_SCHEMAS = {
  general: generalSettingsSchema,
  transaction: transactionSettingsSchema,
  print: printSettingsSchema,
  tax: taxSettingsSchema,
  party: partySettingsSchema,
  item: itemSettingsSchema,
  message: messageSettingsSchema,
} as const;

export function schemaForTab(tab: SettingsTab) {
  return TAB_SCHEMAS[tab];
}

/** Every default, used when a company row is first created. */
export function defaultSettings(): AppSettings {
  return settingsSchema.parse({
    general: {},
    transaction: {},
    print: {},
    tax: {},
    party: {},
    item: {},
    message: {},
  });
}

/**
 * Parse stored JSON into a complete settings object. Unknown keys are dropped
 * and missing keys take their default, so an older row keeps working after a
 * new setting ships.
 */
export function parseSettings(row: {
  general: unknown;
  transaction: unknown;
  print: unknown;
  tax: unknown;
  party: unknown;
  item: unknown;
  message: unknown;
} | null): AppSettings {
  // Note the `z.output<S>` return: these schemas carry defaults, so their input
  // and output types differ and a naive `z.ZodType<T>` would infer the input.
  const safe = <S extends z.ZodTypeAny>(
    schema: S,
    value: unknown,
    fallback: z.output<S>,
  ): z.output<S> => {
    const result = schema.safeParse(value ?? {});
    return result.success ? (result.data as z.output<S>) : fallback;
  };

  const defaults = defaultSettings();
  if (!row) return defaults;

  return {
    general: safe(generalSettingsSchema, row.general, defaults.general),
    transaction: safe(transactionSettingsSchema, row.transaction, defaults.transaction),
    print: safe(printSettingsSchema, row.print, defaults.print),
    tax: safe(taxSettingsSchema, row.tax, defaults.tax),
    party: safe(partySettingsSchema, row.party, defaults.party),
    item: safe(itemSettingsSchema, row.item, defaults.item),
    message: safe(messageSettingsSchema, row.message, defaults.message),
  };
}

/**
 * The subset of settings the sidebar consults to decide which nav items exist.
 * Mirrors the "More Transactions" block in ref-11.
 */
export function navFeatureFlags(settings: AppSettings): Record<string, boolean> {
  return {
    enableEstimate: settings.general.enableEstimate,
    enableProforma: settings.general.enableProforma,
    enableOrders: settings.general.enableOrders,
    enableDeliveryChallan: settings.general.enableDeliveryChallan,
    enableOtherIncome: settings.general.enableOtherIncome,
    enableFixedAssets: settings.general.enableFixedAssets,
  };
}

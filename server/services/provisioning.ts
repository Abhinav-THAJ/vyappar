import { TransactionType, type Prisma } from "@prisma/client";
import { defaultSettings } from "@/lib/validators/settings";
import { normalizeName } from "@/lib/utils";
import { currentFinancialYear } from "@/lib/fy";

/** Units every Indian business starts with; more can be added per company. */
export const DEFAULT_UNITS: { name: string; shortName: string }[] = [
  { name: "Pieces", shortName: "PCS" },
  { name: "Numbers", shortName: "NOS" },
  { name: "Kilograms", shortName: "KG" },
  { name: "Grams", shortName: "GM" },
  { name: "Litres", shortName: "LTR" },
  { name: "Metres", shortName: "MTR" },
  { name: "Feet", shortName: "FT" },
  { name: "Square Feet", shortName: "SQF" },
  { name: "Box", shortName: "BOX" },
  { name: "Packet", shortName: "PKT" },
  { name: "Dozen", shortName: "DZN" },
  { name: "Bags", shortName: "BAG" },
  { name: "Hours", shortName: "HRS" },
  { name: "Days", shortName: "DAY" },
  { name: "Sets", shortName: "SET" },
];

/** The GST rate master from the brief, plus exempt and nil-rated. */
export const DEFAULT_TAX_RATES: {
  name: string;
  rate: string;
  isExempt?: boolean;
  isNilRated?: boolean;
  sortOrder: number;
}[] = [
  { name: "Exempted", rate: "0", isExempt: true, sortOrder: 0 },
  { name: "Nil Rated", rate: "0", isNilRated: true, sortOrder: 1 },
  { name: "GST @ 0%", rate: "0", sortOrder: 2 },
  { name: "GST @ 0.25%", rate: "0.25", sortOrder: 3 },
  { name: "GST @ 3%", rate: "3", sortOrder: 4 },
  { name: "GST @ 5%", rate: "5", sortOrder: 5 },
  { name: "GST @ 12%", rate: "12", sortOrder: 6 },
  { name: "GST @ 18%", rate: "18", sortOrder: 7 },
  { name: "GST @ 28%", rate: "28", sortOrder: 8 },
];

/**
 * Default number-series prefixes per document type.
 *
 * Sale invoices deliberately default to an **empty** prefix, because the
 * reference firm numbers its invoices as bare integers (428-434 in ref-04) and
 * an empty prefix has to be a legal, round-tripping value (D-09).
 */
export const DEFAULT_PREFIXES: Partial<Record<TransactionType, string>> = {
  [TransactionType.SALE]: "",
  [TransactionType.SALE_RETURN]: "CN-",
  [TransactionType.ESTIMATE]: "EST-",
  [TransactionType.PROFORMA]: "PI-",
  [TransactionType.SALE_ORDER]: "SO-",
  [TransactionType.DELIVERY_CHALLAN]: "DC-",
  [TransactionType.PAYMENT_IN]: "RCPT-",
  [TransactionType.PURCHASE]: "PUR-",
  [TransactionType.PURCHASE_RETURN]: "DN-",
  [TransactionType.PURCHASE_ORDER]: "PO-",
  [TransactionType.PAYMENT_OUT]: "PAY-",
  [TransactionType.EXPENSE]: "EXP-",
};

export const NUMBERED_TYPES = Object.keys(DEFAULT_PREFIXES) as TransactionType[];

export interface ProvisionCompanyInput {
  userId: string;
  companyName: string;
  firmName?: string;
  gstin?: string | null;
  stateCode: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  pincode?: string | null;
  phone?: string | null;
  email?: string | null;
  fyStartMonth: number;
  isGstEnabled: boolean;
}

/**
 * Create a company with everything it needs to be immediately usable: the
 * owner membership, a default firm, settings, the unit and tax masters, and a
 * number sequence per document type for the current financial year.
 *
 * Runs inside a caller-supplied transaction so a half-built company can never
 * be committed.
 */
export async function provisionCompany(
  tx: Prisma.TransactionClient,
  input: ProvisionCompanyInput,
): Promise<{ companyId: string; firmId: string }> {
  const company = await tx.company.create({
    data: {
      name: input.companyName,
      ownerId: input.userId,
      fyStartMonth: input.fyStartMonth,
      isGstEnabled: input.isGstEnabled,
      members: {
        create: { userId: input.userId, role: "OWNER", acceptedAt: new Date() },
      },
    },
    select: { id: true },
  });

  const firmName = input.firmName?.trim() || input.companyName;

  const firm = await tx.firm.create({
    data: {
      companyId: company.id,
      name: firmName,
      nameNormalized: normalizeName(firmName),
      gstin: input.gstin ?? null,
      stateCode: input.stateCode,
      addressLine1: input.addressLine1 ?? null,
      addressLine2: input.addressLine2 ?? null,
      city: input.city ?? null,
      pincode: input.pincode ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      isDefault: true,
    },
    select: { id: true },
  });

  const settings = defaultSettings();
  await tx.settings.create({
    data: {
      companyId: company.id,
      general: settings.general,
      transaction: settings.transaction,
      print: settings.print,
      tax: { ...settings.tax, enableGst: input.isGstEnabled },
      party: settings.party,
      item: settings.item,
      message: settings.message,
    },
  });

  await tx.unit.createMany({
    data: DEFAULT_UNITS.map((u) => ({ ...u, companyId: company.id })),
  });

  await tx.taxRate.createMany({
    data: DEFAULT_TAX_RATES.map((t) => ({
      companyId: company.id,
      name: t.name,
      rate: t.rate,
      isExempt: t.isExempt ?? false,
      isNilRated: t.isNilRated ?? false,
      isSystem: true,
      sortOrder: t.sortOrder,
    })),
  });

  await tx.expenseCategory.createMany({
    data: [
      { companyId: company.id, name: "Rent", expenseType: "INDIRECT" as const },
      { companyId: company.id, name: "Salary", expenseType: "INDIRECT" as const },
      { companyId: company.id, name: "Transport", expenseType: "DIRECT" as const },
      { companyId: company.id, name: "Petrol", expenseType: "INDIRECT" as const },
      { companyId: company.id, name: "Tea", expenseType: "INDIRECT" as const },
    ],
  });

  await createNumberSequences(tx, company.id, firm.id, input.fyStartMonth);

  return { companyId: company.id, firmId: firm.id };
}

/** One sequence per numbered document type, for the current financial year. */
export async function createNumberSequences(
  tx: Prisma.TransactionClient,
  companyId: string,
  firmId: string,
  fyStartMonth: number,
): Promise<void> {
  const fy = currentFinancialYear(fyStartMonth);

  await tx.numberSequence.createMany({
    data: NUMBERED_TYPES.map((type) => ({
      companyId,
      firmId,
      type,
      financialYear: fy,
      prefix: DEFAULT_PREFIXES[type] ?? "",
      nextNumber: 1,
      resetYearly: true,
    })),
    skipDuplicates: true,
  });
}

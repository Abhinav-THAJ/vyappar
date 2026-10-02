import { z } from "zod";
import {
  zRequiredString,
  zOptionalString,
  zPhone,
  zEmailOptional,
  zGstin,
  zStateCode,
} from "./common";

export const BUSINESS_CATEGORIES = [
  "Retail",
  "Wholesale / Distribution",
  "Manufacturing",
  "Services",
  "Events & Catering",
  "Restaurant / Cafe",
  "Construction",
  "Transport & Logistics",
  "Healthcare",
  "Education",
  "Other",
] as const;

/** Step 1 of the wizard, matching the captured fields in ref-10. */
export const businessDetailsSchema = z.object({
  companyName: zRequiredString("Company name", 120),
  phone: z.string().trim().min(1, "Phone number is required").pipe(zPhone),
  businessCategory: z.enum(BUSINESS_CATEGORIES, {
    errorMap: () => ({ message: "Choose a business category" }),
  }),
});

/** Step 2: tax identity. */
export const taxDetailsSchema = z.object({
  gstin: zGstin,
  stateCode: zStateCode,
  isGstEnabled: z.boolean().default(true),
});

/** Step 3: address and contact, which print on the invoice header. */
export const addressDetailsSchema = z.object({
  addressLine1: zOptionalString,
  addressLine2: zOptionalString,
  city: zOptionalString,
  pincode: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v))
    .refine((v) => v === undefined || /^\d{6}$/.test(v), "PIN code must be 6 digits"),
  email: zEmailOptional,
});

/** Step 4: financial year. */
export const preferencesSchema = z.object({
  fyStartMonth: z.coerce.number().int().min(1).max(12).default(4),
});

/** The whole wizard, submitted in one action. */
export const createCompanySchema = businessDetailsSchema
  .merge(taxDetailsSchema)
  .merge(addressDetailsSchema)
  .merge(preferencesSchema)
  .superRefine((value, ctx) => {
    // A GSTIN encodes its own state; a mismatch is a data-entry error.
    if (value.gstin && value.gstin.slice(0, 2) !== value.stateCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stateCode"],
        message: `This GSTIN belongs to state code ${value.gstin.slice(0, 2)}`,
      });
    }
  });

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

/** Editing a firm inside a company (Settings > Firms). */
export const firmSchema = z.object({
  id: z.string().optional(),
  name: zRequiredString("Firm name", 120),
  gstin: zGstin,
  stateCode: zStateCode,
  addressLine1: zOptionalString,
  addressLine2: zOptionalString,
  city: zOptionalString,
  pincode: zOptionalString,
  phone: zPhone,
  email: zEmailOptional,
  bankName: zOptionalString,
  bankAccountNo: zOptionalString,
  bankIfsc: zOptionalString,
  upiId: zOptionalString,
  termsAndConditions: zOptionalString,
  isDefault: z.boolean().default(false),
});

export type FirmInput = z.infer<typeof firmSchema>;

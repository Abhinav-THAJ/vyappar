import { z } from "zod";
import {
  zRequiredString,
  zOptionalString,
  zPhone,
  zEmailOptional,
  zGstin,
  zStateCode,
  zMoney,
  zDateInputOptional,
  zCuidOptional,
} from "./common";

export const PARTY_TYPES = ["CUSTOMER", "SUPPLIER", "BOTH"] as const;
export const GST_TYPES = [
  "UNREGISTERED",
  "REGISTERED",
  "COMPOSITION",
  "CONSUMER",
  "OVERSEAS",
  "SEZ",
] as const;

export const GST_TYPE_LABELS: Record<(typeof GST_TYPES)[number], string> = {
  UNREGISTERED: "Unregistered / Consumer",
  REGISTERED: "Registered — Regular",
  COMPOSITION: "Registered — Composition",
  CONSUMER: "Consumer",
  OVERSEAS: "Overseas",
  SEZ: "SEZ",
};

export const partySchema = z
  .object({
    id: zCuidOptional,
    name: zRequiredString("Party name", 200),
    type: z.enum(PARTY_TYPES).default("CUSTOMER"),
    gstType: z.enum(GST_TYPES).default("UNREGISTERED"),
    gstin: zGstin,
    stateCode: zStateCode.optional(),
    phone: zPhone,
    email: zEmailOptional,
    billingAddress: zOptionalString,
    shippingAddress: zOptionalString,
    partyGroupId: zCuidOptional,

    openingBalance: zMoney.default("0"),
    openingBalanceType: z.enum(["TO_RECEIVE", "TO_PAY"]).default("TO_RECEIVE"),
    openingAsOf: zDateInputOptional,

    creditLimit: zMoney.optional(),
    paymentTermDays: z.coerce.number().int().min(0).max(365).optional(),

    customFields: z.record(z.string()).default({}),
  })
  .superRefine((value, ctx) => {
    // A registered party must have a GSTIN — that is what "registered" means.
    if (
      (value.gstType === "REGISTERED" || value.gstType === "COMPOSITION" || value.gstType === "SEZ") &&
      !value.gstin
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["gstin"],
        message: "A registered party needs a GSTIN",
      });
    }

    // The GSTIN carries its own state; a mismatch is a data-entry error.
    if (value.gstin && value.stateCode && value.gstin.slice(0, 2) !== value.stateCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stateCode"],
        message: `This GSTIN belongs to state code ${value.gstin.slice(0, 2)}`,
      });
    }

    if (Number(value.openingBalance) !== 0 && !value.openingAsOf) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["openingAsOf"],
        message: "An opening balance needs an as-of date",
      });
    }
  });

export type PartyInput = z.infer<typeof partySchema>;

export const partyGroupSchema = z.object({
  id: zCuidOptional,
  name: zRequiredString("Group name", 80),
});

export const deletePartySchema = z.object({ id: z.string().min(1) });

import { z } from "zod";
import { validateGstin, isValidHsnSac, INDIAN_STATES } from "@/lib/gst";

/** A money amount arriving from a form: string, number, or blank. */
export const zMoney = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? v.toString() : v.trim()))
  .refine((v) => v === "" || /^-?\d*\.?\d*$/.test(v), "Enter a valid amount")
  .transform((v) => (v === "" || v === "-" || v === "." ? "0" : v))
  .refine((v) => Number.isFinite(Number(v)), "Enter a valid amount");

/** A non-negative money amount. */
export const zMoneyPositive = zMoney.refine(
  (v) => Number(v) >= 0,
  "Amount cannot be negative",
);

export const zQty = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? v.toString() : v.trim()))
  .transform((v) => (v === "" || v === "-" || v === "." ? "0" : v))
  .refine((v) => Number.isFinite(Number(v)), "Enter a valid quantity");

export const zPercent = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? v.toString() : v.trim()))
  .transform((v) => (v === "" ? "0" : v))
  .refine((v) => Number.isFinite(Number(v)), "Enter a valid percentage")
  .refine((v) => Number(v) >= 0 && Number(v) <= 100, "Percentage must be between 0 and 100");

export const zOptionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

export const zRequiredString = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);

/** Indian mobile: ten digits, optionally with +91 or a leading zero. */
export const zPhone = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v))
  .refine(
    (v) => v === undefined || /^(\+?91[-\s]?)?[0]?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, "")),
    "Enter a valid 10-digit mobile number",
  );

export const zEmailOptional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v))
  .refine((v) => v === undefined || z.string().email().safeParse(v).success, "Enter a valid email");

export const STATE_CODES = INDIAN_STATES.map((s) => s.code) as [string, ...string[]];

export const zStateCode = z.enum(STATE_CODES, {
  errorMap: () => ({ message: "Select a valid state" }),
});

export const zGstin = z
  .string()
  .trim()
  .toUpperCase()
  .optional()
  .transform((v) => (v === "" ? undefined : v))
  .superRefine((v, ctx) => {
    if (v === undefined) return;
    const result = validateGstin(v);
    if (!result.valid) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error ?? "Invalid GSTIN" });
    }
  });

export const zHsnSac = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v))
  .refine((v) => isValidHsnSac(v), "HSN/SAC must be 4, 6 or 8 digits");

/** An <input type="date"> value. */
export const zDateInput = z
  .string()
  .trim()
  .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), "Enter a valid date");

export const zDateInputOptional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v))
  .refine((v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v), "Enter a valid date");

export const zCuid = z.string().min(1, "Required");
export const zCuidOptional = z
  .string()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

/** Cursor-less server-side pagination, used by every list screen. */
export const zPagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  sort: z.string().optional(),
  dir: z.enum(["asc", "desc"]).default("desc"),
  q: z.string().trim().optional(),
});

export type Pagination = z.infer<typeof zPagination>;

import { z } from "zod";
import {
  zRequiredString,
  zOptionalString,
  zMoney,
  zDateInput,
  zDateInputOptional,
  zCuidOptional,
} from "./common";

export const bankAccountSchema = z.object({
  id: zCuidOptional,
  displayName: zRequiredString("Account name", 80),
  bankName: zOptionalString,
  accountNumber: zOptionalString,
  ifsc: zOptionalString
    .refine(
      (v) => v === undefined || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.toUpperCase()),
      "IFSC must be 4 letters, a zero, then 6 characters",
    ),
  upiId: zOptionalString,
  openingBalance: zMoney.default("0"),
  openingAsOf: zDateInputOptional,
});

export type BankAccountInput = z.infer<typeof bankAccountSchema>;

export const TRANSFER_KINDS = [
  "BANK_TO_BANK",
  "CASH_TO_BANK",
  "BANK_TO_CASH",
] as const;

export const TRANSFER_LABELS: Record<(typeof TRANSFER_KINDS)[number], string> = {
  BANK_TO_BANK: "Bank to bank",
  CASH_TO_BANK: "Cash to bank (deposit)",
  BANK_TO_CASH: "Bank to cash (withdrawal)",
};

export const transferSchema = z
  .object({
    kind: z.enum(TRANSFER_KINDS),
    date: zDateInput,
    amount: zMoney.refine((v) => Number(v) > 0, "Enter an amount"),
    fromBankAccountId: zCuidOptional,
    toBankAccountId: zCuidOptional,
    reference: zOptionalString,
    notes: zOptionalString,
  })
  .superRefine((value, ctx) => {
    if (value.kind === "BANK_TO_BANK") {
      if (!value.fromBankAccountId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fromBankAccountId"], message: "Choose the source account" });
      }
      if (!value.toBankAccountId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["toBankAccountId"], message: "Choose the destination account" });
      }
      if (
        value.fromBankAccountId &&
        value.fromBankAccountId === value.toBankAccountId
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["toBankAccountId"],
          message: "Choose a different destination account",
        });
      }
    }

    if (value.kind === "CASH_TO_BANK" && !value.toBankAccountId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["toBankAccountId"], message: "Choose the bank account" });
    }

    if (value.kind === "BANK_TO_CASH" && !value.fromBankAccountId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fromBankAccountId"], message: "Choose the bank account" });
    }
  });

export type TransferInput = z.infer<typeof transferSchema>;

export const cashAdjustSchema = z.object({
  direction: z.enum(["ADD", "REDUCE"]),
  date: zDateInput,
  amount: zMoney.refine((v) => Number(v) > 0, "Enter an amount"),
  notes: zOptionalString,
});

export const chequeStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["OPEN", "DEPOSITED", "WITHDRAWN", "BOUNCED"]),
  closedOn: zDateInputOptional,
});

export const loanAccountSchema = z.object({
  id: zCuidOptional,
  lenderName: zRequiredString("Lender", 120),
  accountNumber: zOptionalString,
  openingBalance: zMoney.default("0"),
  openingAsOf: zDateInputOptional,
  interestRate: z.coerce.number().min(0).max(100).optional(),
  termMonths: z.coerce.number().int().min(0).max(600).optional(),
  description: zOptionalString,
});

export type LoanAccountInput = z.infer<typeof loanAccountSchema>;

export const loanTransactionSchema = z.object({
  loanAccountId: z.string().min(1),
  date: zDateInput,
  principal: zMoney.default("0"),
  interest: zMoney.default("0"),
  charges: zMoney.default("0"),
  note: zOptionalString,
});

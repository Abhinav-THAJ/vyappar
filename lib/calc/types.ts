import type Decimal from "decimal.js";

export type Num = Decimal.Value;

export interface CalcLineInput {
  /** Stable key so results can be matched back to form rows. */
  key: string;
  qty: Num;
  /** Price per unit, in the sense given by `rateIsTaxInclusive`. */
  rate: Num;
  rateIsTaxInclusive: boolean;
  /** Line discount. Percent when `discountIsPercent`, else an absolute amount. */
  discountValue?: Num;
  discountIsPercent?: boolean;
  /** GST rate as a percentage: 0, 0.25, 3, 5, 12, 18 or 28. */
  taxRate: Num;
  /** Cess as a percentage, applied on the same base as GST. */
  cessRate?: Num;
  hsnSac?: string | null;
  /** Free quantity is delivered but never charged or taxed. */
  freeQty?: Num;
}

export interface AdditionalChargeInput {
  name: string;
  amount: Num;
  /** Omit or null for a charge that carries no GST. */
  taxRate?: Num | null;
}

export type RoundOffMode = "nearest" | "up" | "down";

export interface CalcInput {
  lines: CalcLineInput[];
  /** Bill-level discount, applied after line discounts and before tax. */
  billDiscountValue?: Num;
  billDiscountIsPercent?: boolean;
  additionalCharges?: AdditionalChargeInput[];
  /** true -> IGST at the full rate; false -> CGST + SGST at half each. */
  isIgst: boolean;
  /** TCS percentage on (taxable value + tax). */
  tcsRate?: Num;
  roundOffEnabled?: boolean;
  roundOffMode?: RoundOffMode;
}

export interface CalcLineResult {
  key: string;
  /** Rate excluding tax, after stripping an inclusive price. */
  exclusiveRate: string;
  /** qty x exclusiveRate, before any discount. */
  grossAmount: string;
  lineDiscountAmount: string;
  /** This line's share of the bill-level discount. */
  billDiscountShare: string;
  taxableValue: string;
  taxRate: string;
  cessRate: string;
  cgst: string;
  sgst: string;
  igst: string;
  cessAmount: string;
  /** taxableValue + all tax on this line. */
  amount: string;
}

export interface TaxBreakupRow {
  hsnSac: string;
  rate: string;
  cessRate: string;
  taxableValue: string;
  cgst: string;
  sgst: string;
  igst: string;
  cessAmount: string;
}

export interface ChargeResult {
  name: string;
  amount: string;
  taxRate: string | null;
  taxAmount: string;
}

export interface CalcResult {
  lines: CalcLineResult[];
  charges: ChargeResult[];
  /** Sum of line taxable values after line discounts, before the bill discount. */
  subTotal: string;
  totalLineDiscount: string;
  billDiscountAmount: string;
  additionalChargesTotal: string;
  /** The GST base: line taxable values after every discount, plus taxable charges. */
  taxableValue: string;
  cgst: string;
  sgst: string;
  igst: string;
  cess: string;
  totalTax: string;
  tcs: string;
  roundOff: string;
  total: string;
  taxBreakup: TaxBreakupRow[];
}

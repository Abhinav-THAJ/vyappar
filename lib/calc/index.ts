import Decimal from "decimal.js";
import { d, money, sum, s, ZERO, HUNDRED } from "./money";
import type {
  CalcInput,
  CalcLineResult,
  CalcResult,
  ChargeResult,
  TaxBreakupRow,
} from "./types";

export * from "./types";
export { d, money, qty, s } from "./money";

/**
 * The single source of truth for every currency figure in the application.
 *
 * Pure and synchronous: no I/O, no Prisma, no dates. The server re-runs this on
 * every save and persists only its own result, so a tampered client payload can
 * never change an invoice's value (D-17).
 *
 * Order of operations, fixed by the brief:
 *   1. strip tax from inclusive rates
 *   2. gross = qty x exclusive rate
 *   3. line discount
 *   4. bill discount, apportioned pro rata across lines
 *   5. additional charges
 *   6. GST split by place of supply
 *   7. TCS
 *   8. round off
 *
 * Invariant: the header equals the sum of the rounded line values exactly,
 * because the header is computed *from* those rounded values.
 */
export function computeTransaction(input: CalcInput): CalcResult {
  const isIgst = input.isIgst;

  // --- 1-4a: per-line, up to the pre-bill-discount taxable value ------------
  const staged = input.lines.map((line) => {
    const lineQty = d(line.qty);
    const rate = d(line.rate);
    const taxRate = d(line.taxRate);
    const cessRate = d(line.cessRate ?? 0);

    // 1. An inclusive price carries both GST and cess, so both come out.
    const divisor = HUNDRED.plus(taxRate).plus(cessRate);
    const exclusiveRate = line.rateIsTaxInclusive
      ? divisor.isZero()
        ? rate
        : rate.times(HUNDRED).dividedBy(divisor)
      : rate;

    // 2. Free quantity ships but is never charged.
    const grossAmount = lineQty.times(exclusiveRate);

    // 3. Line discount.
    const discountValue = d(line.discountValue ?? 0);
    const lineDiscountAmount = line.discountIsPercent
      ? grossAmount.times(discountValue).dividedBy(HUNDRED)
      : discountValue;

    const afterLineDiscount = grossAmount.minus(lineDiscountAmount);

    return {
      key: line.key,
      hsnSac: line.hsnSac ?? "",
      taxRate,
      cessRate,
      exclusiveRate,
      grossAmount,
      lineDiscountAmount,
      afterLineDiscount,
    };
  });

  const subTotalRaw = sum(staged.map((l) => l.afterLineDiscount));

  // --- 4b: bill-level discount, apportioned pro rata by taxable value ------
  const billDiscountValue = d(input.billDiscountValue ?? 0);
  const billDiscountRaw = input.billDiscountIsPercent
    ? subTotalRaw.times(billDiscountValue).dividedBy(HUNDRED)
    : billDiscountValue;

  // Clamp to [0, subTotal]. Guard the negative-subtotal case explicitly: a
  // credit-note line can be negative, and clamping against it would otherwise
  // wipe the whole document.
  const billDiscountAmount = billDiscountRaw.lessThanOrEqualTo(0)
    ? ZERO
    : subTotalRaw.lessThanOrEqualTo(0)
      ? ZERO
      : Decimal.min(billDiscountRaw, subTotalRaw);

  const shares = apportion(
    billDiscountAmount,
    staged.map((l) => l.afterLineDiscount),
  );

  // --- 5-6: tax each line on its final base -------------------------------
  const lines: CalcLineResult[] = staged.map((line, i) => {
    const share = shares[i] ?? ZERO;
    const taxableRaw = line.afterLineDiscount.minus(share);
    const taxable = money(taxableRaw);

    const gstAmount = taxable.times(line.taxRate).dividedBy(HUNDRED);
    const cessAmount = money(taxable.times(line.cessRate).dividedBy(HUNDRED));

    // Half each for CGST and SGST; the split is rounded so the two always re-sum.
    const cgst = isIgst ? ZERO : money(gstAmount.dividedBy(2));
    const sgst = isIgst ? ZERO : money(gstAmount).minus(cgst);
    const igst = isIgst ? money(gstAmount) : ZERO;

    const amount = taxable.plus(cgst).plus(sgst).plus(igst).plus(cessAmount);

    return {
      key: line.key,
      exclusiveRate: line.exclusiveRate.toFixed(4),
      grossAmount: s(money(line.grossAmount)),
      lineDiscountAmount: s(money(line.lineDiscountAmount)),
      billDiscountShare: s(money(share)),
      taxableValue: s(taxable),
      taxRate: line.taxRate.toFixed(3),
      cessRate: line.cessRate.toFixed(3),
      cgst: s(cgst),
      sgst: s(sgst),
      igst: s(igst),
      cessAmount: s(cessAmount),
      amount: s(amount),
    };
  });

  // --- 5: additional charges ----------------------------------------------
  const charges: ChargeResult[] = [];
  let taxableChargesBase = ZERO;
  let nonTaxableCharges = ZERO;
  let chargeCgst = ZERO;
  let chargeSgst = ZERO;
  let chargeIgst = ZERO;

  for (const charge of input.additionalCharges ?? []) {
    const amount = money(charge.amount);
    const hasTax = charge.taxRate !== null && charge.taxRate !== undefined;
    const rate = hasTax ? d(charge.taxRate) : null;

    if (rate && !rate.isZero()) {
      const gst = amount.times(rate).dividedBy(HUNDRED);
      const cgst = isIgst ? ZERO : money(gst.dividedBy(2));
      const sgst = isIgst ? ZERO : money(gst).minus(cgst);
      const igst = isIgst ? money(gst) : ZERO;

      taxableChargesBase = taxableChargesBase.plus(amount);
      chargeCgst = chargeCgst.plus(cgst);
      chargeSgst = chargeSgst.plus(sgst);
      chargeIgst = chargeIgst.plus(igst);

      charges.push({
        name: charge.name,
        amount: s(amount),
        taxRate: rate.toFixed(3),
        taxAmount: s(cgst.plus(sgst).plus(igst)),
      });
    } else {
      // A zero-rated charge still belongs in the tax base for reporting.
      if (hasTax) taxableChargesBase = taxableChargesBase.plus(amount);
      else nonTaxableCharges = nonTaxableCharges.plus(amount);

      charges.push({
        name: charge.name,
        amount: s(amount),
        taxRate: hasTax ? "0.000" : null,
        taxAmount: "0.00",
      });
    }
  }

  // --- headers, summed from the rounded line values ------------------------
  const linesTaxable = sum(lines.map((l) => d(l.taxableValue)));
  const taxableValue = linesTaxable.plus(taxableChargesBase);

  const cgst = sum(lines.map((l) => d(l.cgst))).plus(chargeCgst);
  const sgst = sum(lines.map((l) => d(l.sgst))).plus(chargeSgst);
  const igst = sum(lines.map((l) => d(l.igst))).plus(chargeIgst);
  const cess = sum(lines.map((l) => d(l.cessAmount)));
  const totalTax = cgst.plus(sgst).plus(igst).plus(cess);

  // --- 7: TCS on taxable value + tax --------------------------------------
  const tcsRate = d(input.tcsRate ?? 0);
  const tcs = tcsRate.isZero()
    ? ZERO
    : money(taxableValue.plus(totalTax).times(tcsRate).dividedBy(HUNDRED));

  const preRound = taxableValue
    .plus(totalTax)
    .plus(nonTaxableCharges)
    .plus(tcs);

  // --- 8: round off --------------------------------------------------------
  const roundOff = input.roundOffEnabled
    ? roundOffDelta(preRound, input.roundOffMode ?? "nearest")
    : ZERO;

  const total = money(preRound.plus(roundOff));

  const totalLineDiscount = sum(lines.map((l) => d(l.lineDiscountAmount)));
  const additionalChargesTotal = taxableChargesBase.plus(nonTaxableCharges);

  return {
    lines,
    charges,
    subTotal: s(money(subTotalRaw)),
    totalLineDiscount: s(totalLineDiscount),
    billDiscountAmount: s(money(billDiscountAmount)),
    additionalChargesTotal: s(money(additionalChargesTotal)),
    taxableValue: s(taxableValue),
    cgst: s(cgst),
    sgst: s(sgst),
    igst: s(igst),
    cess: s(cess),
    totalTax: s(totalTax),
    tcs: s(tcs),
    roundOff: s(roundOff),
    total: s(total),
    taxBreakup: buildTaxBreakup(lines, input),
  };
}

/**
 * Split `total` across `weights` in proportion, at paise precision, so the
 * parts always re-sum to the whole. The rounding remainder goes to the largest
 * weight, which is the line least distorted by it (D-08).
 */
export function apportion(total: Decimal, weights: Decimal[]): Decimal[] {
  if (total.isZero() || weights.length === 0) return weights.map(() => ZERO);

  const weightTotal = sum(weights);
  if (weightTotal.isZero()) {
    // Nothing to weight by: put it all on the first line.
    return weights.map((_, i) => (i === 0 ? money(total) : ZERO));
  }

  const parts = weights.map((w) => money(total.times(w).dividedBy(weightTotal)));
  const allocated = sum(parts);
  const remainder = money(total).minus(allocated);

  if (!remainder.isZero()) {
    let largestIndex = 0;
    for (let i = 1; i < weights.length; i += 1) {
      if ((weights[i] ?? ZERO).greaterThan(weights[largestIndex] ?? ZERO)) largestIndex = i;
    }
    parts[largestIndex] = (parts[largestIndex] ?? ZERO).plus(remainder);
  }

  return parts;
}

/** The signed adjustment that takes `value` to a whole rupee. */
export function roundOffDelta(value: Decimal, mode: "nearest" | "up" | "down"): Decimal {
  const rounded =
    mode === "up"
      ? value.toDecimalPlaces(0, Decimal.ROUND_CEIL)
      : mode === "down"
        ? value.toDecimalPlaces(0, Decimal.ROUND_FLOOR)
        : value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  return money(rounded.minus(value));
}

/** HSN-wise tax summary for the invoice footer and the GST reports (ref-10). */
function buildTaxBreakup(lines: CalcLineResult[], input: CalcInput): TaxBreakupRow[] {
  const byKey = new Map<string, TaxBreakupRow>();

  lines.forEach((line, i) => {
    const source = input.lines[i];
    const hsnSac = source?.hsnSac ?? "";
    const key = `${hsnSac}|${line.taxRate}|${line.cessRate}`;

    const existing = byKey.get(key);
    if (existing) {
      existing.taxableValue = s(d(existing.taxableValue).plus(d(line.taxableValue)));
      existing.cgst = s(d(existing.cgst).plus(d(line.cgst)));
      existing.sgst = s(d(existing.sgst).plus(d(line.sgst)));
      existing.igst = s(d(existing.igst).plus(d(line.igst)));
      existing.cessAmount = s(d(existing.cessAmount).plus(d(line.cessAmount)));
    } else {
      byKey.set(key, {
        hsnSac,
        rate: line.taxRate,
        cessRate: line.cessRate,
        taxableValue: line.taxableValue,
        cgst: line.cgst,
        sgst: line.sgst,
        igst: line.igst,
        cessAmount: line.cessAmount,
      });
    }
  });

  return [...byKey.values()].sort((a, b) => {
    if (a.hsnSac !== b.hsnSac) return a.hsnSac.localeCompare(b.hsnSac);
    return d(a.rate).comparedTo(d(b.rate));
  });
}

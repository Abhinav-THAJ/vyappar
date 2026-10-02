import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { computeTransaction, apportion, d, type CalcInput } from "@/lib/calc";
import { GST_RATES } from "@/lib/gst";

function line(over: Partial<CalcInput["lines"][number]> = {}) {
  return {
    key: "l1",
    qty: 1,
    rate: 100,
    rateIsTaxInclusive: false,
    taxRate: 18,
    ...over,
  };
}

function base(over: Partial<CalcInput> = {}): CalcInput {
  return { lines: [line()], isIgst: false, ...over };
}

/** The header must always equal the sum of the rounded line values. */
function expectLinesSumToHeader(result: ReturnType<typeof computeTransaction>) {
  const sumOf = (pick: (l: (typeof result.lines)[number]) => string) =>
    result.lines.reduce((acc, l) => acc.plus(d(pick(l))), new Decimal(0));

  // Charges are added on top of the line totals, so compare against the line part only.
  const chargeTax = result.charges.reduce((acc, c) => acc.plus(d(c.taxAmount)), new Decimal(0));
  const chargeBase = result.charges
    .filter((c) => c.taxRate !== null)
    .reduce((acc, c) => acc.plus(d(c.amount)), new Decimal(0));

  expect(d(result.taxableValue).minus(chargeBase).toFixed(2)).toBe(
    sumOf((l) => l.taxableValue).toFixed(2),
  );
  expect(
    d(result.cgst).plus(d(result.sgst)).plus(d(result.igst)).minus(chargeTax).toFixed(2),
  ).toBe(
    sumOf((l) => l.cgst)
      .plus(sumOf((l) => l.sgst))
      .plus(sumOf((l) => l.igst))
      .toFixed(2),
  );
}

describe("computeTransaction — place of supply", () => {
  it("splits CGST and SGST equally for an intra-state supply", () => {
    const r = computeTransaction(base({ lines: [line({ qty: 10, rate: 100 })] }));
    expect(r.taxableValue).toBe("1000.00");
    expect(r.cgst).toBe("90.00");
    expect(r.sgst).toBe("90.00");
    expect(r.igst).toBe("0.00");
    expect(r.total).toBe("1180.00");
  });

  it("charges IGST at the full rate for an inter-state supply", () => {
    const r = computeTransaction(base({ lines: [line({ qty: 10, rate: 100 })], isIgst: true }));
    expect(r.cgst).toBe("0.00");
    expect(r.sgst).toBe("0.00");
    expect(r.igst).toBe("180.00");
    expect(r.total).toBe("1180.00");
  });

  it("keeps CGST + SGST equal to IGST for an odd tax amount", () => {
    const intra = computeTransaction(base({ lines: [line({ qty: 1, rate: 100.05, taxRate: 5 })] }));
    const inter = computeTransaction(
      base({ lines: [line({ qty: 1, rate: 100.05, taxRate: 5 })], isIgst: true }),
    );
    expect(d(intra.cgst).plus(d(intra.sgst)).toFixed(2)).toBe(inter.igst);
    expect(intra.total).toBe(inter.total);
  });
});

describe("computeTransaction — inclusive vs exclusive pricing", () => {
  it("strips tax from an inclusive rate", () => {
    const r = computeTransaction(
      base({ lines: [line({ qty: 1, rate: 118, rateIsTaxInclusive: true, taxRate: 18 })] }),
    );
    expect(r.taxableValue).toBe("100.00");
    expect(r.cgst).toBe("9.00");
    expect(r.sgst).toBe("9.00");
    expect(r.total).toBe("118.00");
  });

  it("strips both GST and cess from an inclusive rate", () => {
    const r = computeTransaction(
      base({
        lines: [line({ qty: 1, rate: 140, rateIsTaxInclusive: true, taxRate: 28, cessRate: 12 })],
      }),
    );
    // 140 / 1.40 = 100
    expect(r.taxableValue).toBe("100.00");
    expect(r.cess).toBe("12.00");
    expect(r.total).toBe("140.00");
  });

  it("inclusive and exclusive reach the same total for the same base", () => {
    const excl = computeTransaction(base({ lines: [line({ qty: 3, rate: 250, taxRate: 12 })] }));
    const incl = computeTransaction(
      base({ lines: [line({ qty: 3, rate: 280, rateIsTaxInclusive: true, taxRate: 12 })] }),
    );
    expect(incl.total).toBe(excl.total);
  });

  it("treats a zero-rated inclusive price as its own exclusive price", () => {
    const r = computeTransaction(
      base({ lines: [line({ qty: 2, rate: 500, rateIsTaxInclusive: true, taxRate: 0 })] }),
    );
    expect(r.taxableValue).toBe("1000.00");
    expect(r.total).toBe("1000.00");
  });
});

describe("computeTransaction — discounts", () => {
  it("applies a percentage line discount before tax", () => {
    const r = computeTransaction(
      base({ lines: [line({ qty: 1, rate: 1000, discountValue: 10, discountIsPercent: true })] }),
    );
    expect(r.totalLineDiscount).toBe("100.00");
    expect(r.taxableValue).toBe("900.00");
    expect(r.total).toBe("1062.00");
  });

  it("applies an absolute line discount before tax", () => {
    const r = computeTransaction(
      base({ lines: [line({ qty: 1, rate: 1000, discountValue: 150 })] }),
    );
    expect(r.taxableValue).toBe("850.00");
    expect(r.total).toBe("1003.00");
  });

  it("applies a percentage bill discount after line discounts", () => {
    const r = computeTransaction(
      base({
        lines: [line({ qty: 1, rate: 1000, discountValue: 10, discountIsPercent: true })],
        billDiscountValue: 10,
        billDiscountIsPercent: true,
      }),
    );
    // 1000 -10% = 900, then -10% = 810
    expect(r.subTotal).toBe("900.00");
    expect(r.billDiscountAmount).toBe("90.00");
    expect(r.taxableValue).toBe("810.00");
  });

  it("never discounts below zero", () => {
    const r = computeTransaction(
      base({ lines: [line({ qty: 1, rate: 100 })], billDiscountValue: 500 }),
    );
    expect(r.billDiscountAmount).toBe("100.00");
    expect(r.taxableValue).toBe("0.00");
    expect(r.total).toBe("0.00");
  });

  it("apportions a bill discount pro rata so each line's tax base falls correctly", () => {
    // Two lines at different GST rates: the split must follow the taxable value.
    const r = computeTransaction({
      isIgst: false,
      lines: [
        line({ key: "a", qty: 1, rate: 1000, taxRate: 5 }),
        line({ key: "b", qty: 1, rate: 3000, taxRate: 18 }),
      ],
      billDiscountValue: 400,
    });

    // 400 split 1:3 -> 100 and 300
    expect(r.lines[0]?.billDiscountShare).toBe("100.00");
    expect(r.lines[1]?.billDiscountShare).toBe("300.00");
    expect(r.lines[0]?.taxableValue).toBe("900.00");
    expect(r.lines[1]?.taxableValue).toBe("2700.00");
    // 900 @5% = 45, 2700 @18% = 486
    expect(d(r.lines[0]!.cgst).plus(d(r.lines[0]!.sgst)).toFixed(2)).toBe("45.00");
    expect(d(r.lines[1]!.cgst).plus(d(r.lines[1]!.sgst)).toFixed(2)).toBe("486.00");
    expectLinesSumToHeader(r);
  });

  it("gives the apportionment remainder to the largest line and still re-sums", () => {
    const r = computeTransaction({
      isIgst: false,
      lines: [
        line({ key: "a", qty: 1, rate: 100, taxRate: 18 }),
        line({ key: "b", qty: 1, rate: 100, taxRate: 18 }),
        line({ key: "c", qty: 1, rate: 100.01, taxRate: 18 }),
      ],
      billDiscountValue: 10,
    });
    const shares = r.lines.map((l) => d(l.billDiscountShare));
    expect(shares.reduce((a, b) => a.plus(b), new Decimal(0)).toFixed(2)).toBe("10.00");
    expectLinesSumToHeader(r);
  });
});

describe("apportion", () => {
  it("always re-sums to the total", () => {
    const parts = apportion(d(100), [d(1), d(1), d(1)]);
    expect(parts.reduce((a, b) => a.plus(b), new Decimal(0)).toFixed(2)).toBe("100.00");
  });

  it("puts everything on the first entry when all weights are zero", () => {
    const parts = apportion(d(50), [d(0), d(0)]);
    expect(parts[0]?.toFixed(2)).toBe("50.00");
    expect(parts[1]?.toFixed(2)).toBe("0.00");
  });

  it("returns zeros for a zero total", () => {
    const parts = apportion(d(0), [d(5), d(5)]);
    expect(parts.every((p) => p.isZero())).toBe(true);
  });
});

describe("computeTransaction — additional charges", () => {
  it("adds an untaxed charge to the total but not the tax base", () => {
    const r = computeTransaction(
      base({
        lines: [line({ qty: 1, rate: 1000 })],
        additionalCharges: [{ name: "Shipping", amount: 100 }],
      }),
    );
    expect(r.taxableValue).toBe("1000.00");
    expect(r.additionalChargesTotal).toBe("100.00");
    expect(r.total).toBe("1280.00"); // 1000 + 180 tax + 100
  });

  it("taxes a charge that carries a rate", () => {
    const r = computeTransaction(
      base({
        lines: [line({ qty: 1, rate: 1000 })],
        additionalCharges: [{ name: "Packaging", amount: 100, taxRate: 18 }],
      }),
    );
    expect(r.taxableValue).toBe("1100.00");
    expect(r.cgst).toBe("99.00");
    expect(r.sgst).toBe("99.00");
    expect(r.total).toBe("1298.00");
  });
});

describe("computeTransaction — TCS and round off", () => {
  it("applies TCS on taxable value plus tax", () => {
    const r = computeTransaction(
      base({ lines: [line({ qty: 1, rate: 1000 })], tcsRate: 0.1 }),
    );
    // (1000 + 180) * 0.1% = 1.18
    expect(r.tcs).toBe("1.18");
    expect(r.total).toBe("1181.18");
  });

  it("rounds to the nearest rupee and reports the delta", () => {
    const r = computeTransaction(
      base({ lines: [line({ qty: 1, rate: 100.4, taxRate: 0 })], roundOffEnabled: true }),
    );
    expect(r.roundOff).toBe("-0.40");
    expect(r.total).toBe("100.00");
  });

  it("rounds up when asked", () => {
    const r = computeTransaction(
      base({
        lines: [line({ qty: 1, rate: 100.2, taxRate: 0 })],
        roundOffEnabled: true,
        roundOffMode: "up",
      }),
    );
    expect(r.roundOff).toBe("0.80");
    expect(r.total).toBe("101.00");
  });

  it("leaves the total untouched when round off is disabled", () => {
    const r = computeTransaction(base({ lines: [line({ qty: 1, rate: 100.4, taxRate: 0 })] }));
    expect(r.roundOff).toBe("0.00");
    expect(r.total).toBe("100.40");
  });
});

describe("computeTransaction — every supported GST rate", () => {
  for (const rate of GST_RATES) {
    it(`computes correctly at ${rate}%`, () => {
      const r = computeTransaction(base({ lines: [line({ qty: 1, rate: 10000, taxRate: rate })] }));
      const expectedTax = new Decimal(10000).times(rate).dividedBy(100);
      expect(d(r.cgst).plus(d(r.sgst)).toFixed(2)).toBe(expectedTax.toFixed(2));
      expect(r.total).toBe(new Decimal(10000).plus(expectedTax).toFixed(2));
      expectLinesSumToHeader(r);
    });
  }
});

describe("computeTransaction — the full matrix", () => {
  const rates = [0, 0.25, 5, 18, 28];
  const inclusive = [true, false];
  const percentDiscount = [true, false];
  const igst = [true, false];

  it("keeps lines summing to the header across every combination", () => {
    for (const taxRate of rates) {
      for (const rateIsTaxInclusive of inclusive) {
        for (const discountIsPercent of percentDiscount) {
          for (const isIgst of igst) {
            for (const cessRate of [0, 12]) {
              for (const tcsRate of [0, 0.1]) {
                for (const roundOffEnabled of [true, false]) {
                  const r = computeTransaction({
                    isIgst,
                    tcsRate,
                    roundOffEnabled,
                    billDiscountValue: discountIsPercent ? 5 : 137.77,
                    billDiscountIsPercent: discountIsPercent,
                    lines: [
                      {
                        key: "a",
                        qty: 3,
                        rate: 333.33,
                        rateIsTaxInclusive,
                        taxRate,
                        cessRate,
                        discountValue: discountIsPercent ? 7 : 11.11,
                        discountIsPercent,
                      },
                      {
                        key: "b",
                        qty: 1.5,
                        rate: 1999.99,
                        rateIsTaxInclusive,
                        taxRate,
                        cessRate,
                      },
                    ],
                    additionalCharges: [
                      { name: "Shipping", amount: 49.99 },
                      { name: "Packing", amount: 25, taxRate },
                    ],
                  });

                  expectLinesSumToHeader(r);
                  // The total must never be NaN or negative for positive inputs.
                  expect(d(r.total).isFinite()).toBe(true);
                  expect(d(r.total).greaterThanOrEqualTo(0)).toBe(true);
                  if (roundOffEnabled) {
                    expect(d(r.total).modulo(1).toFixed(2)).toBe("0.00");
                  }
                }
              }
            }
          }
        }
      }
    }
  });
});

describe("computeTransaction — HSN summary", () => {
  it("groups by HSN, rate and cess", () => {
    const r = computeTransaction({
      isIgst: false,
      lines: [
        line({ key: "a", qty: 1, rate: 1000, taxRate: 18, hsnSac: "9985" }),
        line({ key: "b", qty: 1, rate: 2000, taxRate: 18, hsnSac: "9985" }),
        line({ key: "c", qty: 1, rate: 500, taxRate: 5, hsnSac: "9963" }),
      ],
    });

    expect(r.taxBreakup).toHaveLength(2);
    const sac9963 = r.taxBreakup.find((t) => t.hsnSac === "9963");
    const sac9985 = r.taxBreakup.find((t) => t.hsnSac === "9985");
    expect(sac9985?.taxableValue).toBe("3000.00");
    expect(sac9985?.cgst).toBe("270.00");
    expect(sac9963?.taxableValue).toBe("500.00");
    expect(sac9963?.cgst).toBe("12.50");
  });
});

describe("computeTransaction — regression fixtures taken from ref-04", () => {
  /**
   * Invoice 433, SECRETARY REGENCY CLUB, total ₹2,06,743.08.
   * That total is exactly a taxable value of ₹1,75,206 at 18% GST, intra-state
   * (the firm is in Kerala), which is what these numbers have to reproduce.
   */
  it("reproduces invoice 433 at ₹2,06,743.08", () => {
    const r = computeTransaction({
      isIgst: false,
      lines: [line({ key: "a", qty: 1, rate: 175206, taxRate: 18 })],
    });
    expect(r.taxableValue).toBe("175206.00");
    expect(r.cgst).toBe("15768.54");
    expect(r.sgst).toBe("15768.54");
    expect(r.total).toBe("206743.08");
  });

  /** Invoice 432, Thrissur district Sports council, ₹2,050 with no GST. */
  it("reproduces invoice 432 at ₹2,050.00", () => {
    const r = computeTransaction({
      isIgst: false,
      lines: [line({ key: "a", qty: 1, rate: 2050, taxRate: 0 })],
    });
    expect(r.total).toBe("2050.00");
  });

  /**
   * The seven invoices visible in ref-04 must sum to the summary card's
   * "Total Sales Amount ₹13,21,350.08".
   */
  it("sums the visible September invoices to the summary card total", () => {
    const totals = [362797, 206743.08, 2050, 358500, 375000, 4661, 11599];
    const sum = totals.reduce((acc, t) => acc.plus(t), new Decimal(0));
    expect(sum.toFixed(2)).toBe("1321350.08");
  });

  /** Invoice 434 was partly paid: ₹3,62,797 total less ₹1,50,000 received. */
  it("reproduces the received and balance split on the summary card", () => {
    const total = new Decimal(1321350.08);
    const received = new Decimal(150000);
    expect(total.minus(received).toFixed(2)).toBe("1171350.08");
  });
});

describe("computeTransaction — edge cases", () => {
  it("handles an empty line list", () => {
    const r = computeTransaction({ lines: [], isIgst: false });
    expect(r.total).toBe("0.00");
    expect(r.taxableValue).toBe("0.00");
    expect(r.taxBreakup).toHaveLength(0);
  });

  it("handles a zero-quantity line", () => {
    const r = computeTransaction(base({ lines: [line({ qty: 0, rate: 500 })] }));
    expect(r.total).toBe("0.00");
  });

  it("handles fractional quantities", () => {
    const r = computeTransaction(base({ lines: [line({ qty: 2.5, rate: 40, taxRate: 0 })] }));
    expect(r.taxableValue).toBe("100.00");
  });

  it("handles a negative line, as used by a credit note adjustment", () => {
    const r = computeTransaction(base({ lines: [line({ qty: 1, rate: -100, taxRate: 18 })] }));
    expect(r.taxableValue).toBe("-100.00");
    expect(r.total).toBe("-118.00");
  });
});

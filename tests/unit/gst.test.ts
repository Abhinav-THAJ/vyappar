import { describe, expect, it } from "vitest";
import {
  validateGstin,
  gstinCheckDigit,
  stateCodeFromGstin,
  resolvePlaceOfSupply,
  isValidHsnSac,
  stateByCode,
  stateByName,
  INDIAN_STATES,
} from "@/lib/gst";
import {
  financialYearOf,
  financialYearRange,
  recentFinancialYears,
} from "@/lib/fy";
import { formatDate } from "@/lib/format/date";

/** Build a GSTIN with a correct check digit so fixtures stay valid. */
function makeGstin(first14: string): string {
  return first14 + (gstinCheckDigit(first14) ?? "");
}

describe("validateGstin", () => {
  it("accepts a well-formed GSTIN with a correct check digit", () => {
    const gstin = makeGstin("32FNWPS9685D1Z");
    const result = validateGstin(gstin);
    expect(result.valid).toBe(true);
    expect(result.stateCode).toBe("32");
    expect(result.stateName).toBe("Kerala");
    expect(result.pan).toBe("FNWPS9685D");
  });

  it("rejects a bad check digit", () => {
    const good = makeGstin("32FNWPS9685D1Z");
    const lastChar = good[14]!;
    const wrong = good.slice(0, 14) + (lastChar === "A" ? "B" : "A");
    const result = validateGstin(wrong);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/check digit/i);
  });

  it("rejects the wrong length", () => {
    expect(validateGstin("32FNWPS9685D1Z").valid).toBe(false);
    expect(validateGstin("32FNWPS9685D1Z11").valid).toBe(false);
  });

  it("rejects an unknown state code", () => {
    const result = validateGstin(makeGstin("99FNWPS9685D1Z"));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/state code/i);
  });

  it("rejects a malformed body", () => {
    expect(validateGstin("321234S9685D1Z5").valid).toBe(false);
  });

  it("rejects empty input", () => {
    expect(validateGstin("").valid).toBe(false);
    expect(validateGstin(null).valid).toBe(false);
  });

  it("is case insensitive and trims", () => {
    const gstin = makeGstin("27AAPFU0939F1Z");
    expect(validateGstin(`  ${gstin.toLowerCase()}  `).valid).toBe(true);
  });
});

describe("stateCodeFromGstin", () => {
  it("extracts a valid state code", () => {
    expect(stateCodeFromGstin("32FNWPS9685D1Z1")).toBe("32");
    expect(stateCodeFromGstin("27AAPFU0939F1ZV")).toBe("27");
  });

  it("returns null for an unknown code", () => {
    expect(stateCodeFromGstin("99AAPFU0939F1ZV")).toBeNull();
    expect(stateCodeFromGstin(null)).toBeNull();
  });
});

describe("state master", () => {
  it("looks up by code and by name", () => {
    expect(stateByCode("32")?.name).toBe("Kerala");
    expect(stateByName("kerala")?.code).toBe("32");
    expect(stateByCode("7")?.name).toBe("Delhi"); // pads to "07"
  });

  it("has unique codes", () => {
    const codes = INDIAN_STATES.map((s) => s.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("resolvePlaceOfSupply", () => {
  it("is intra-state when the party matches the firm", () => {
    const r = resolvePlaceOfSupply({ firmStateCode: "32", partyStateCode: "32" });
    expect(r.isIgst).toBe(false);
    expect(r.stateCode).toBe("32");
  });

  it("is inter-state when the party differs", () => {
    const r = resolvePlaceOfSupply({ firmStateCode: "32", partyStateCode: "27" });
    expect(r.isIgst).toBe(true);
    expect(r.stateCode).toBe("27");
  });

  it("defaults an unregistered party to the firm state", () => {
    const r = resolvePlaceOfSupply({ firmStateCode: "32", partyStateCode: null });
    expect(r.isIgst).toBe(false);
    expect(r.stateCode).toBe("32");
  });

  it("honours an explicit override", () => {
    const r = resolvePlaceOfSupply({
      firmStateCode: "32",
      partyStateCode: "32",
      overrideStateCode: "29",
    });
    expect(r.isIgst).toBe(true);
    expect(r.stateCode).toBe("29");
  });

  it("follows the firm, so one party can be intra for one firm and inter for another", () => {
    const kerala = resolvePlaceOfSupply({ firmStateCode: "32", partyStateCode: "32" });
    const karnataka = resolvePlaceOfSupply({ firmStateCode: "29", partyStateCode: "32" });
    expect(kerala.isIgst).toBe(false);
    expect(karnataka.isIgst).toBe(true);
  });
});

describe("isValidHsnSac", () => {
  it("accepts 4, 6 and 8 digit codes and blank", () => {
    expect(isValidHsnSac("9985")).toBe(true);
    expect(isValidHsnSac("998596")).toBe(true);
    expect(isValidHsnSac("99859600")).toBe(true);
    expect(isValidHsnSac("")).toBe(true);
    expect(isValidHsnSac(null)).toBe(true);
  });

  it("rejects other shapes", () => {
    expect(isValidHsnSac("99")).toBe(false);
    expect(isValidHsnSac("99859")).toBe(false);
    expect(isValidHsnSac("ABCD")).toBe(false);
  });
});

describe("financial year", () => {
  it("places September 2026 in FY 2026-27", () => {
    expect(financialYearOf(new Date("2026-09-19T05:15:00Z"))).toBe("2026-27");
  });

  it("places March 2026 in FY 2025-26", () => {
    // The Settings backup line in ref-11 reads 05/03/2026.
    expect(financialYearOf(new Date("2026-03-05T06:33:00Z"))).toBe("2025-26");
  });

  it("rolls over exactly on 1 April", () => {
    expect(financialYearOf(new Date("2026-03-31T18:29:00Z"))).toBe("2025-26");
    expect(financialYearOf(new Date("2026-03-31T18:31:00Z"))).toBe("2026-27");
  });

  it("honours a non-April start month", () => {
    expect(financialYearOf(new Date("2026-02-15T06:00:00Z"), 1)).toBe("2026-27");
  });

  it("produces the right range for a label", () => {
    const range = financialYearRange("2026-27");
    expect(formatDate(range.from)).toBe("01/04/2026");
    expect(formatDate(range.to)).toBe("31/03/2027");
  });

  it("rejects a malformed label", () => {
    expect(() => financialYearRange("not-a-year")).toThrow();
  });

  it("lists recent years newest first", () => {
    const years = recentFinancialYears(3);
    expect(years).toHaveLength(3);
    expect(years[0]).toMatch(/^\d{4}-\d{2}$/);
    expect(Number(years[0]!.slice(0, 4))).toBeGreaterThan(Number(years[1]!.slice(0, 4)));
  });
});

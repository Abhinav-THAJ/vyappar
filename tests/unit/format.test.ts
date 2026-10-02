import { describe, expect, it } from "vitest";
import {
  indianGroup,
  formatNumber,
  formatCurrency,
  formatQty,
  formatPercent,
  percentChange,
  parseNumericInput,
} from "@/lib/format/number";
import { amountInWords, numberToIndianWords } from "@/lib/format/words";
import { formatDate, formatDateTime, formatActivity, parseIndianDate } from "@/lib/format/date";

describe("indianGroup", () => {
  it.each([
    ["1", "1"],
    ["12", "12"],
    ["123", "123"],
    ["1234", "1,234"],
    ["12345", "12,345"],
    ["123456", "1,23,456"],
    ["1234567", "12,34,567"],
    // The three figures visible in the references.
    ["13812793", "1,38,12,793"],
    ["733500", "7,33,500"],
    ["1321350", "13,21,350"],
    ["-1234567", "-12,34,567"],
  ])("groups %s as %s", (input, expected) => {
    expect(indianGroup(input)).toBe(expected);
  });
});

describe("formatCurrency", () => {
  it("matches the list-screen format from ref-04", () => {
    expect(formatCurrency(1321350.08)).toBe("₹ 13,21,350.08");
    expect(formatCurrency(206743.08)).toBe("₹ 2,06,743.08");
    expect(formatCurrency(2050)).toBe("₹ 2,050.00");
  });

  it("matches the dashboard format from ref-01 at zero decimals", () => {
    expect(formatCurrency(13812793, { decimals: 0 })).toBe("₹ 1,38,12,793");
    expect(formatCurrency(89555, { decimals: 0 })).toBe("₹ 89,555");
  });

  it("puts the sign before the symbol for a negative", () => {
    expect(formatCurrency(-2050)).toBe("-₹ 2,050.00");
  });

  it("renders null and undefined as zero", () => {
    expect(formatCurrency(null)).toBe("₹ 0.00");
    expect(formatCurrency(undefined)).toBe("₹ 0.00");
  });
});

describe("formatQty", () => {
  it("trims trailing zeros for whole quantities, as ref-03 shows", () => {
    expect(formatQty(-150)).toBe("-150");
    expect(formatQty(0)).toBe("0");
    expect(formatQty(-3)).toBe("-3");
  });

  it("keeps three decimals when they carry information", () => {
    expect(formatQty(2.5)).toBe("2.500");
  });
});

describe("formatNumber and formatPercent", () => {
  it("formats the two delta styles seen in the references", () => {
    expect(formatPercent(390.18, 2)).toBe("390.18%");
    expect(formatPercent(390, 0)).toBe("390%");
  });

  it("rounds half-up", () => {
    expect(formatNumber(2.345, { decimals: 2 })).toBe("2.35");
  });
});

describe("percentChange", () => {
  it("computes a period-over-period rise", () => {
    expect(percentChange(200, 100)?.toFixed(2)).toBe("100.00");
  });

  it("returns null rather than infinity when the previous period is zero", () => {
    expect(percentChange(500, 0)).toBeNull();
  });
});

describe("parseNumericInput", () => {
  it("strips grouping, the rupee sign and spaces", () => {
    expect(parseNumericInput("₹ 13,21,350.08")?.toFixed(2)).toBe("1321350.08");
    expect(parseNumericInput("1,234")?.toFixed(2)).toBe("1234.00");
  });

  it("rejects incomplete input", () => {
    expect(parseNumericInput("")).toBeNull();
    expect(parseNumericInput("-")).toBeNull();
    expect(parseNumericInput("abc")).toBeNull();
  });
});

describe("numberToIndianWords", () => {
  it.each([
    [0, "Zero"],
    [7, "Seven"],
    [15, "Fifteen"],
    [42, "Forty Two"],
    [100, "One Hundred"],
    [101, "One Hundred One"],
    [999, "Nine Hundred Ninety Nine"],
    [1000, "One Thousand"],
    [12000, "Twelve Thousand"],
    [100000, "One Lakh"],
    [120000, "One Lakh Twenty Thousand"],
    [1000000, "Ten Lakh"],
    [10000000, "One Crore"],
    [13812793, "One Crore Thirty Eight Lakh Twelve Thousand Seven Hundred Ninety Three"],
  ])("renders %s", (input, expected) => {
    expect(numberToIndianWords(input)).toBe(expected);
  });
});

describe("amountInWords", () => {
  it("matches the brief's worked example", () => {
    expect(amountInWords(120000)).toBe("One Lakh Twenty Thousand Rupees Only");
  });

  it("includes paise when present", () => {
    expect(amountInWords(2050.5)).toBe("Two Thousand Fifty Rupees and Fifty Paise Only");
  });

  it("renders the ref-04 invoice total", () => {
    expect(amountInWords(206743.08)).toBe(
      "Two Lakh Six Thousand Seven Hundred Forty Three Rupees and Eight Paise Only",
    );
  });

  it("carries rounding of 99.995 paise into the rupees", () => {
    expect(amountInWords(99.999)).toBe("One Hundred Rupees Only");
  });

  it("handles zero and negatives", () => {
    expect(amountInWords(0)).toBe("Zero Rupees Only");
    expect(amountInWords(-50)).toBe("Minus Fifty Rupees Only");
  });
});

describe("date formatting", () => {
  // 19 Sep 2026, 10:45 IST -> 05:15 UTC
  const instant = new Date("2026-09-19T05:15:00.000Z");

  it("formats dates the way every reference table does", () => {
    expect(formatDate(instant)).toBe("19/09/2026");
  });

  it("formats the settings backup timestamp style", () => {
    expect(formatDateTime(instant)).toBe("19/09/2026 | 10:45 AM");
  });

  it("formats the company-list activity style from ref-12", () => {
    expect(formatActivity(instant)).toBe("19/09/2026 at 10:45 am");
  });

  it("round-trips a typed date", () => {
    const parsed = parseIndianDate("19/09/2026");
    expect(parsed).not.toBeNull();
    expect(formatDate(parsed)).toBe("19/09/2026");
  });

  it("rejects an unparseable date", () => {
    expect(parseIndianDate("not a date")).toBeNull();
  });

  it("returns an empty string for null", () => {
    expect(formatDate(null)).toBe("");
  });
});

import Decimal from "decimal.js";

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
] as const;

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
] as const;

/** 0-99 in words. */
function twoDigits(n: number): string {
  if (n < 20) return ONES[n] ?? "";
  const tens = Math.floor(n / 10);
  const rest = n % 10;
  const tensWord = TENS[tens] ?? "";
  return rest === 0 ? tensWord : `${tensWord} ${ONES[rest]}`;
}

/** 0-999 in words. */
function threeDigits(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds === 0) return twoDigits(rest);
  const head = `${ONES[hundreds]} Hundred`;
  return rest === 0 ? head : `${head} ${twoDigits(rest)}`;
}

/**
 * Whole number in the Indian system: crore / lakh / thousand / hundred.
 * Handles up to 99,99,99,99,999 (arab-scale values fall back to crores).
 */
export function numberToIndianWords(value: number): string {
  if (!Number.isFinite(value)) return "";
  const n = Math.floor(Math.abs(value));
  if (n === 0) return "Zero";

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;

  const parts: string[] = [];
  // Crores beyond 99 are spoken as a plain count of crores, e.g. "One Thousand Crore".
  if (crore > 0) parts.push(`${numberToIndianWords(crore)} Crore`);
  if (lakh > 0) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest > 0) parts.push(threeDigits(rest));

  return parts.join(" ");
}

/**
 * Invoice "Amount in Words" block (ref-10).
 *   120000      -> "One Lakh Twenty Thousand Rupees Only"
 *   2050.50     -> "Two Thousand Fifty Rupees and Fifty Paise Only"
 */
export function amountInWords(value: Decimal.Value | null | undefined): string {
  if (value === null || value === undefined) return "";
  const d = new Decimal(value);
  if (!d.isFinite()) return "";

  const negative = d.isNegative();
  const abs = d.abs().toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const rupees = abs.floor().toNumber();
  const paise = abs.minus(abs.floor()).times(100).round().toNumber();

  // Rounding paise to 100 carries into the rupees.
  const carriedRupees = paise === 100 ? rupees + 1 : rupees;
  const carriedPaise = paise === 100 ? 0 : paise;

  const rupeeWords = numberToIndianWords(carriedRupees);
  const head = carriedPaise > 0
    ? `${rupeeWords} Rupees and ${twoDigits(carriedPaise)} Paise`
    : `${rupeeWords} Rupees`;

  return `${negative ? "Minus " : ""}${head} Only`;
}

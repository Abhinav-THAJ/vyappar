import { toZonedTime } from "date-fns-tz";
import { IST, startOfDayIST, endOfDayIST } from "@/lib/format/date";

/** Default Indian financial year starts in April. */
export const DEFAULT_FY_START_MONTH = 4;

export interface FyRange {
  /** Canonical label, e.g. "2026-27". */
  label: string;
  from: Date;
  to: Date;
}

/**
 * The financial-year label a date falls in.
 * With a start month of 4, 19/09/2026 is in "2026-27" and 05/03/2026 is in "2025-26".
 */
export function financialYearOf(date: Date, startMonth = DEFAULT_FY_START_MONTH): string {
  const zoned = toZonedTime(date, IST);
  const month = zoned.getMonth() + 1;
  const year = zoned.getFullYear();
  const startYear = month >= startMonth ? year : year - 1;
  const endShort = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}-${endShort}`;
}

/** The date range covered by a financial-year label. */
export function financialYearRange(
  label: string,
  startMonth = DEFAULT_FY_START_MONTH,
): FyRange {
  const startYear = Number.parseInt(label.slice(0, 4), 10);
  if (!Number.isFinite(startYear)) {
    throw new Error(`Invalid financial year label: ${label}`);
  }
  const from = startOfDayIST(new Date(startYear, startMonth - 1, 1));
  // Day 0 of the start month next year is the last day of the FY.
  const to = endOfDayIST(new Date(startYear + 1, startMonth - 1, 0));
  return { label, from, to };
}

/** The financial year containing today. */
export function currentFinancialYear(startMonth = DEFAULT_FY_START_MONTH): string {
  return financialYearOf(new Date(), startMonth);
}

/** A descending list of FY labels for pickers, newest first. */
export function recentFinancialYears(
  count = 5,
  startMonth = DEFAULT_FY_START_MONTH,
): string[] {
  const current = currentFinancialYear(startMonth);
  const startYear = Number.parseInt(current.slice(0, 4), 10);
  return Array.from({ length: count }, (_, i) => {
    const y = startYear - i;
    return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
  });
}

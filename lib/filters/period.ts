import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  subMonths,
  subYears,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { IST, startOfDayIST, endOfDayIST, todayIST } from "@/lib/format/date";
import { financialYearOf, financialYearRange, DEFAULT_FY_START_MONTH } from "@/lib/fy";

/** The period presets behind every "This Month" dropdown in the references. */
export const PERIOD_PRESETS = [
  "today",
  "yesterday",
  "this-week",
  "this-month",
  "last-month",
  "this-quarter",
  "this-fy",
  "last-fy",
  "custom",
] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "this-week": "This Week",
  "this-month": "This Month",
  "last-month": "Last Month",
  "this-quarter": "This Quarter",
  "this-fy": "This Financial Year",
  "last-fy": "Last Financial Year",
  custom: "Custom",
};

export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Resolve a preset to an IST date range.
 *
 * The comparison range is the equivalent immediately-preceding window, which is
 * what drives the "390% more than last month" delta on the dashboard.
 */
export function resolvePeriod(
  preset: PeriodPreset,
  fyStartMonth = DEFAULT_FY_START_MONTH,
  custom?: Partial<DateRange>,
): DateRange {
  const now = toZonedTime(new Date(), IST);

  switch (preset) {
    case "today":
      return { from: todayIST(), to: endOfDayIST(now) };

    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { from: startOfDayIST(y), to: endOfDayIST(y) };
    }

    case "this-week":
      return {
        from: startOfDayIST(startOfWeek(now, { weekStartsOn: 1 })),
        to: endOfDayIST(endOfWeek(now, { weekStartsOn: 1 })),
      };

    case "this-month":
      return { from: startOfDayIST(startOfMonth(now)), to: endOfDayIST(endOfMonth(now)) };

    case "last-month": {
      const prev = subMonths(now, 1);
      return { from: startOfDayIST(startOfMonth(prev)), to: endOfDayIST(endOfMonth(prev)) };
    }

    case "this-quarter":
      return { from: startOfDayIST(startOfQuarter(now)), to: endOfDayIST(endOfQuarter(now)) };

    case "this-fy": {
      const range = financialYearRange(financialYearOf(new Date(), fyStartMonth), fyStartMonth);
      return { from: range.from, to: range.to };
    }

    case "last-fy": {
      const label = financialYearOf(subYears(new Date(), 1), fyStartMonth);
      const range = financialYearRange(label, fyStartMonth);
      return { from: range.from, to: range.to };
    }

    case "custom":
      return {
        from: custom?.from ? startOfDayIST(custom.from) : startOfDayIST(startOfMonth(now)),
        to: custom?.to ? endOfDayIST(custom.to) : endOfDayIST(endOfMonth(now)),
      };
  }
}

/**
 * The immediately preceding window of the same length, for period-over-period
 * comparisons. Month presets step back a whole calendar month rather than a
 * fixed number of days, so February compares against January, not "28 days ago".
 */
export function previousPeriod(preset: PeriodPreset, range: DateRange): DateRange {
  if (preset === "this-month" || preset === "last-month") {
    const prevMonth = subMonths(range.from, 1);
    return {
      from: startOfDayIST(startOfMonth(prevMonth)),
      to: endOfDayIST(endOfMonth(prevMonth)),
    };
  }

  if (preset === "this-fy" || preset === "last-fy") {
    return {
      from: startOfDayIST(subYears(range.from, 1)),
      to: endOfDayIST(subYears(range.to, 1)),
    };
  }

  const span = range.to.getTime() - range.from.getTime();
  return {
    from: new Date(range.from.getTime() - span - 1),
    to: new Date(range.from.getTime() - 1),
  };
}

export function isPeriodPreset(value: string | null | undefined): value is PeriodPreset {
  return !!value && (PERIOD_PRESETS as readonly string[]).includes(value);
}

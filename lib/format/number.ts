import Decimal from "decimal.js";

/**
 * Indian digit grouping: last three digits, then groups of two.
 *   1234       -> "1,234"
 *   13812793   -> "1,38,12,793"   (matches ref-01)
 *   733500     -> "7,33,500"      (matches ref-02)
 */
export function indianGroup(intPart: string): string {
  const negative = intPart.startsWith("-");
  const digits = negative ? intPart.slice(1) : intPart;

  if (digits.length <= 3) return negative ? `-${digits}` : digits;

  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");

  return `${negative ? "-" : ""}${grouped},${lastThree}`;
}

export interface NumberFormatOptions {
  /** Decimal places. Dashboard KPI cards use 0, every detail surface uses 2 (D-13). */
  decimals?: number;
  /** Render the sign for positive values too. */
  showPlus?: boolean;
}

/** Format a number with Indian grouping, without any currency symbol. */
export function formatNumber(
  value: Decimal.Value | null | undefined,
  options: NumberFormatOptions = {},
): string {
  const { decimals = 2, showPlus = false } = options;
  if (value === null || value === undefined || value === "") return decimals > 0 ? "0.00" : "0";

  const d = new Decimal(value);
  if (!d.isFinite()) return "—";

  const fixed = d.toFixed(decimals, Decimal.ROUND_HALF_UP);
  const [intPart = "0", decPart] = fixed.split(".");
  const grouped = indianGroup(intPart);
  const body = decPart ? `${grouped}.${decPart}` : grouped;

  if (showPlus && d.greaterThan(0)) return `+${body}`;
  return body;
}

/**
 * Currency, matching the reference exactly: the rupee sign, a hair space, then
 * the grouped figure — "₹ 13,21,350.08".
 */
export function formatCurrency(
  value: Decimal.Value | null | undefined,
  options: NumberFormatOptions = {},
): string {
  const d = new Decimal(value ?? 0);
  const body = formatNumber(d.abs(), options);
  return d.isNegative() ? `-₹ ${body}` : `₹ ${body}`;
}

/** Quantity: 3 dp at rest, trailing zeros trimmed for display (ref-03 shows "-150", not "-150.000"). */
export function formatQty(value: Decimal.Value | null | undefined): string {
  if (value === null || value === undefined || value === "") return "0";
  const d = new Decimal(value);
  if (!d.isFinite()) return "—";
  const trimmed = d.toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
  return formatNumber(trimmed, { decimals: trimmed.isInteger() ? 0 : 3 });
}

/** Percentage delta. Lists show 2 dp ("390.18%"), the dashboard shows 0 dp ("390%"). */
export function formatPercent(
  value: Decimal.Value | null | undefined,
  decimals = 2,
): string {
  if (value === null || value === undefined) return "—";
  const d = new Decimal(value);
  if (!d.isFinite()) return "—";
  return `${formatNumber(d, { decimals })}%`;
}

/**
 * Period-over-period change. A zero previous period yields null rather than
 * infinity, which the UI renders as an em dash (A-09).
 */
export function percentChange(
  current: Decimal.Value,
  previous: Decimal.Value,
): Decimal | null {
  const prev = new Decimal(previous);
  if (prev.isZero()) return null;
  return new Decimal(current).minus(prev).dividedBy(prev.abs()).times(100);
}

/** Parse user input that may contain grouping commas, a rupee sign or spaces. */
export function parseNumericInput(raw: string): Decimal | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[₹,\s]/g, "").trim();
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  try {
    const d = new Decimal(cleaned);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

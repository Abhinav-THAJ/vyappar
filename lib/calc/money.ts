import Decimal from "decimal.js";

// Intermediates stay at high precision; only persisted values are rounded.
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export const ZERO = new Decimal(0);
export const HUNDRED = new Decimal(100);

export function d(value: Decimal.Value | null | undefined): Decimal {
  if (value === null || value === undefined || value === "") return ZERO;
  const result = new Decimal(value);
  return result.isFinite() ? result : ZERO;
}

/** Round to paise, half-up. The only rounding applied to stored money. */
export function money(value: Decimal.Value): Decimal {
  return d(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Round to the quantity scale used by the schema. */
export function qty(value: Decimal.Value): Decimal {
  return d(value).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
}

export function sum(values: Decimal[]): Decimal {
  return values.reduce<Decimal>((acc, v) => acc.plus(v), ZERO);
}

/** Serialise for transport across the server/client boundary and into Prisma. */
export function s(value: Decimal): string {
  return value.toFixed(2);
}

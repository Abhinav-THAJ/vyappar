import { stateByCode } from "./states";

export * from "./states";

/** 2-digit state code, 10-char PAN, entity number, "Z", checksum. */
export const GSTIN_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const CHECKSUM_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * The GSTIN check digit: a mod-36 weighted sum over the first 14 characters,
 * alternating weights of 1 and 2.
 */
export function gstinCheckDigit(first14: string): string | null {
  if (first14.length !== 14) return null;

  let total = 0;
  for (let i = 0; i < 14; i += 1) {
    const char = first14[i];
    if (char === undefined) return null;
    const value = CHECKSUM_ALPHABET.indexOf(char);
    if (value < 0) return null;

    const factor = i % 2 === 0 ? 1 : 2;
    const product = value * factor;
    total += Math.floor(product / 36) + (product % 36);
  }

  const remainder = (36 - (total % 36)) % 36;
  return CHECKSUM_ALPHABET[remainder] ?? null;
}

export interface GstinValidation {
  valid: boolean;
  /** Present whenever the first two characters map to a real state. */
  stateCode?: string;
  stateName?: string;
  pan?: string;
  error?: string;
}

/** Validate shape, state code and check digit. */
export function validateGstin(raw: string | null | undefined): GstinValidation {
  if (!raw || raw.trim() === "") {
    return { valid: false, error: "GSTIN is empty" };
  }

  const gstin = raw.trim().toUpperCase();

  if (gstin.length !== 15) {
    return { valid: false, error: "GSTIN must be exactly 15 characters" };
  }

  if (!GSTIN_REGEX.test(gstin)) {
    return { valid: false, error: "GSTIN format is invalid" };
  }

  const stateCode = gstin.slice(0, 2);
  const state = stateByCode(stateCode);
  if (!state) {
    return { valid: false, error: `Unknown GST state code "${stateCode}"` };
  }

  const expected = gstinCheckDigit(gstin.slice(0, 14));
  if (expected !== gstin[14]) {
    return {
      valid: false,
      stateCode,
      stateName: state.name,
      error: "GSTIN check digit does not match",
    };
  }

  return {
    valid: true,
    stateCode,
    stateName: state.name,
    pan: gstin.slice(2, 12),
  };
}

/** The state code embedded in a GSTIN, without full validation. */
export function stateCodeFromGstin(gstin: string | null | undefined): string | null {
  if (!gstin || gstin.trim().length < 2) return null;
  const code = gstin.trim().slice(0, 2);
  return stateByCode(code) ? code : null;
}

export interface PlaceOfSupplyInput {
  /** The supplying firm's state — the firm holds the GSTIN (D-20). */
  firmStateCode: string;
  /** The party's state, or null for an unregistered/consumer party. */
  partyStateCode?: string | null;
  /** Explicit override chosen on the transaction. */
  overrideStateCode?: string | null;
}

export interface PlaceOfSupplyResult {
  stateCode: string;
  /** true -> IGST at the full rate; false -> CGST + SGST. */
  isIgst: boolean;
}

/**
 * Same state as the firm means CGST + SGST; anything else means IGST.
 * An unregistered or consumer party with no state defaults to the firm's state,
 * which is the intra-state case.
 */
export function resolvePlaceOfSupply(input: PlaceOfSupplyInput): PlaceOfSupplyResult {
  const stateCode =
    input.overrideStateCode?.trim() ||
    input.partyStateCode?.trim() ||
    input.firmStateCode;

  return {
    stateCode,
    isIgst: stateCode !== input.firmStateCode,
  };
}

/** HSN is 4/6/8 digits for goods; SAC is 6 digits for services. */
export function isValidHsnSac(value: string | null | undefined): boolean {
  if (!value || value.trim() === "") return true; // optional
  return /^[0-9]{4}$|^[0-9]{6}$|^[0-9]{8}$/.test(value.trim());
}

/** The GST rates the application offers, per the brief. */
export const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28] as const;

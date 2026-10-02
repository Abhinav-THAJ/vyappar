export interface IndianState {
  /** GST state code, two digits, zero-padded. */
  code: string;
  name: string;
  /** Union territories take UTGST in place of SGST. */
  isUnionTerritory?: boolean;
}

/** GST state codes, per the government master. */
export const INDIAN_STATES: readonly IndianState[] = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh", isUnionTerritory: true },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi", isUnionTerritory: true },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu", isUnionTerritory: true },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep", isUnionTerritory: true },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry", isUnionTerritory: true },
  { code: "35", name: "Andaman and Nicobar Islands", isUnionTerritory: true },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh", isUnionTerritory: true },
  { code: "97", name: "Other Territory" },
] as const;

const BY_CODE = new Map(INDIAN_STATES.map((s) => [s.code, s]));
const BY_NAME = new Map(INDIAN_STATES.map((s) => [s.name.toLowerCase(), s]));

export function stateByCode(code: string | null | undefined): IndianState | undefined {
  if (!code) return undefined;
  return BY_CODE.get(code.padStart(2, "0"));
}

export function stateByName(name: string | null | undefined): IndianState | undefined {
  if (!name) return undefined;
  return BY_NAME.get(name.trim().toLowerCase());
}

export function stateName(code: string | null | undefined): string {
  return stateByCode(code)?.name ?? "";
}

/** Kerala — the reference firm's state, and a sensible default for this build. */
export const DEFAULT_STATE_CODE = "32";

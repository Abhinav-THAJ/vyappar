import { format, parse, isValid } from "date-fns";
import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";

/** Every date in this application is business-local to India. */
export const IST = "Asia/Kolkata";

/** "19/09/2026" — the format used in every reference table. */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (!isValid(d)) return "";
  return formatInTimeZone(d, IST, "dd/MM/yyyy");
}

/** "05/03/2026 | 12:03 PM" — the Settings backup line (ref-11). */
export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (!isValid(d)) return "";
  return formatInTimeZone(d, IST, "dd/MM/yyyy | hh:mm a");
}

/** "21/09/2026 at 10:45 am" — the Company List activity line (ref-12). */
export function formatActivity(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (!isValid(d)) return "";
  return formatInTimeZone(d, IST, "dd/MM/yyyy 'at' hh:mm aaa");
}

/** ISO yyyy-MM-dd in IST, for date inputs. */
export function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (!isValid(d)) return "";
  return formatInTimeZone(d, IST, "yyyy-MM-dd");
}

/** Parse "dd/MM/yyyy" (what users type) into a UTC instant at IST midnight. */
export function parseIndianDate(raw: string): Date | null {
  const parsed = parse(raw, "dd/MM/yyyy", new Date());
  if (!isValid(parsed)) return null;
  return fromZonedTime(format(parsed, "yyyy-MM-dd 00:00:00"), IST);
}

/** Parse an <input type="date"> value into a UTC instant at IST midnight. */
export function parseDateInput(raw: string): Date | null {
  if (!raw) return null;
  const parsed = parse(raw, "yyyy-MM-dd", new Date());
  if (!isValid(parsed)) return null;
  return fromZonedTime(format(parsed, "yyyy-MM-dd 00:00:00"), IST);
}

/** Start of day in IST, expressed as a UTC instant. */
export function startOfDayIST(value: Date): Date {
  const zoned = toZonedTime(value, IST);
  return fromZonedTime(format(zoned, "yyyy-MM-dd 00:00:00"), IST);
}

/** End of day in IST, expressed as a UTC instant. */
export function endOfDayIST(value: Date): Date {
  const zoned = toZonedTime(value, IST);
  return fromZonedTime(format(zoned, "yyyy-MM-dd 23:59:59.999"), IST);
}

/** "Now", as the business sees it. */
export function todayIST(): Date {
  return startOfDayIST(new Date());
}

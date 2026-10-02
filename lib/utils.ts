import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Case- and space-insensitive key used for per-company uniqueness. */
export function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Initials for an avatar tile. */
export function initials(name: string, max = 2): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, max)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function truncate(value: string, length: number): string {
  return value.length <= length ? value : `${value.slice(0, length - 1)}…`;
}

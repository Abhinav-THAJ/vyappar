import { resolvePeriod, isPeriodPreset, type PeriodPreset } from "./period";

export * from "./period";

/**
 * Read list-screen filter state out of the URL.
 *
 * This is deliberately a plain module with no `"use client"` directive and no
 * React import: server components, route handlers and the client filter bar all
 * call it, and a client-only module cannot be invoked from the server.
 */
export function readFilterParams(
  searchParams: Record<string, string | string[] | undefined>,
  fyStartMonth: number,
) {
  const get = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const rawPeriod = get("period");
  const preset: PeriodPreset = isPeriodPreset(rawPeriod) ? rawPeriod : "this-month";

  const fromRaw = get("from");
  const toRaw = get("to");

  const range = resolvePeriod(preset, fyStartMonth, {
    from: fromRaw ? new Date(fromRaw) : undefined,
    to: toRaw ? new Date(toRaw) : undefined,
  });

  return {
    preset,
    range,
    firmId: get("firmId") ?? null,
    userId: get("userId") ?? null,
    q: get("q") ?? "",
    page: Math.max(1, Number.parseInt(get("page") ?? "1", 10) || 1),
    pageSize: Math.min(200, Math.max(10, Number.parseInt(get("pageSize") ?? "50", 10) || 50)),
    sort: get("sort") ?? null,
    dir: get("dir") === "asc" ? ("asc" as const) : ("desc" as const),
  };
}

export type ListFilters = ReturnType<typeof readFilterParams>;

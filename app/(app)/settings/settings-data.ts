import { requireCompany } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { parseSettings } from "@/lib/validators/settings";

export const SETTINGS_SELECT = {
  general: true,
  transaction: true,
  print: true,
  tax: true,
  party: true,
  item: true,
  message: true,
} as const;

/** Shared loader for every settings tab. */
export async function loadSettings() {
  const ctx = await requireCompany();

  const row = await ctx.db.settings.findFirst({
    where: { companyId: ctx.companyId },
    select: SETTINGS_SELECT,
  });

  return {
    ctx,
    settings: parseSettings(row),
    canWrite: can(ctx.role, "settings.write"),
  };
}

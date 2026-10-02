"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import {
  SETTINGS_TABS,
  schemaForTab,
  parseSettings,
  type SettingsTab,
} from "@/lib/validators/settings";
import { writeAudit } from "@/server/services/audit";
import { runAction, BusinessError, type ActionResult } from "@/server/guards/action";

const SETTINGS_SELECT = {
  general: true,
  transaction: true,
  print: true,
  tax: true,
  party: true,
  item: true,
  message: true,
} as const;

const saveSettingsSchema = z.object({
  tab: z.enum(SETTINGS_TABS),
  values: z.record(z.unknown()),
});

/**
 * Save one settings tab.
 *
 * The tab's own Zod schema validates the payload, so a malformed or partial
 * blob can never be written — every read elsewhere can assume a complete,
 * well-typed object.
 */
export async function saveSettingsAction(raw: unknown): Promise<ActionResult<{ tab: SettingsTab }>> {
  return runAction(saveSettingsSchema, raw, async ({ tab, values }) => {
    const ctx = await requirePermission("settings.write");

    const parsed = schemaForTab(tab).safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "_form";
        (fieldErrors[key] ??= []).push(issue.message);
      }
      throw new BusinessError("Some settings were not valid", fieldErrors);
    }

    const existing = await ctx.db.settings.findFirst({
      where: { companyId: ctx.companyId },
      select: SETTINGS_SELECT,
    });

    const before = parseSettings(existing);

    await ctx.db.settings.upsert({
      where: { companyId: ctx.companyId },
      create: {
        companyId: ctx.companyId,
        general: before.general,
        transaction: before.transaction,
        print: before.print,
        tax: before.tax,
        party: before.party,
        item: before.item,
        message: before.message,
        [tab]: parsed.data,
      },
      update: { [tab]: parsed.data },
    });

    await writeAudit(ctx, {
      entity: "Settings",
      entityId: ctx.companyId,
      action: "UPDATE",
      before: before[tab],
      after: parsed.data,
    });

    // The General tab decides which nav items exist, so refresh the shell too.
    revalidatePath("/", "layout");
    return { tab };
  });
}

const companyProfileSchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(120),
  fyStartMonth: z.coerce.number().int().min(1).max(12),
  isGstEnabled: z.boolean(),
  isMultiFirm: z.boolean(),
});

/** Company-level profile, which sits above the per-tab settings. */
export async function saveCompanyProfileAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(companyProfileSchema, raw, async (input) => {
    const ctx = await requirePermission("company.manage");

    // Turning multi-firm off with several firms live would orphan their data.
    if (!input.isMultiFirm) {
      const firmCount = await ctx.db.firm.count({ where: { isActive: true } });
      if (firmCount > 1) {
        throw new BusinessError(
          `This company has ${firmCount} firms. Remove the extras before turning Multi Firm off.`,
          { isMultiFirm: ["Remove the extra firms first"] },
        );
      }
    }

    const { prisma } = await import("@/lib/db/prisma");
    await prisma.company.update({
      where: { id: ctx.companyId },
      data: {
        name: input.name,
        fyStartMonth: input.fyStartMonth,
        isGstEnabled: input.isGstEnabled,
        isMultiFirm: input.isMultiFirm,
      },
    });

    revalidatePath("/", "layout");
    return { id: ctx.companyId };
  });
}

const numberSequenceSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string().min(1),
      prefix: z.string().trim().max(12),
      nextNumber: z.coerce.number().int().min(1),
      resetYearly: z.boolean(),
    }),
  ),
});

/** Per-firm numbering: prefixes may legitimately be empty (D-09). */
export async function saveNumberSequencesAction(
  raw: unknown,
): Promise<ActionResult<{ updated: number }>> {
  return runAction(numberSequenceSchema, raw, async ({ updates }) => {
    const ctx = await requirePermission("settings.write");

    for (const update of updates) {
      // The scoped client makes a sequence from another company unreachable.
      await ctx.db.numberSequence.updateMany({
        where: { id: update.id },
        data: {
          prefix: update.prefix,
          nextNumber: update.nextNumber,
          resetYearly: update.resetYearly,
        },
      });
    }

    revalidatePath("/settings/transaction");
    return { updated: updates.length };
  });
}

"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { signOut } from "@/lib/auth";
import {
  clearActiveCompany,
  requireUser,
  setActiveCompany,
  setActiveFirm,
  requireCompany,
} from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { runAction, BusinessError, type ActionResult } from "@/server/guards/action";

/** Sign out and clear the active company, so the next login starts at the picker. */
export async function signOutAction(): Promise<void> {
  await clearActiveCompany();
  await signOut({ redirectTo: "/login" });
}

const switchCompanySchema = z.object({ companyId: z.string().min(1) });

/** Open a company from the Company List (ref-12). */
export async function switchCompanyAction(
  raw: unknown,
): Promise<ActionResult<{ companyId: string }>> {
  return runAction(switchCompanySchema, raw, async ({ companyId }) => {
    const user = await requireUser();

    const membership = await prisma.companyMember.findUnique({
      where: { userId_companyId: { userId: user.id, companyId } },
      select: { company: { select: { id: true, deletedAt: true } } },
    });

    if (!membership || membership.company.deletedAt) {
      throw new BusinessError("You no longer have access to that company");
    }

    await setActiveCompany(companyId);
    return { companyId };
  });
}

const switchFirmSchema = z.object({ firmId: z.string().min(1) });

/** Change the active firm inside the current company. */
export async function switchFirmAction(raw: unknown): Promise<ActionResult<{ firmId: string }>> {
  return runAction(switchFirmSchema, raw, async ({ firmId }) => {
    const ctx = await requireCompany();

    // Scoped client: a firm from another company simply is not found here.
    const firm = await ctx.db.firm.findFirst({
      where: { id: firmId, isActive: true },
      select: { id: true },
    });

    if (!firm) throw new BusinessError("That firm does not belong to this company");

    await setActiveFirm(firmId);
    return { firmId };
  });
}

/** Leave the current company and return to the picker. */
export async function leaveCompanyAction(): Promise<void> {
  await clearActiveCompany();
  redirect("/companies");
}

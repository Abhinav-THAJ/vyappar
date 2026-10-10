"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser, setActiveCompany, setActiveFirm, requirePermission } from "@/lib/auth/session";
import { createCompanySchema, firmSchema } from "@/lib/validators/company";
import { provisionCompany, createNumberSequences } from "@/server/services/provisioning";
import { normalizeName } from "@/lib/utils";
import { runAction, runActionRaw, BusinessError, type ActionResult } from "@/server/guards/action";

/** Run the onboarding wizard: create a company, its first firm and all masters. */
export async function createCompanyAction(
  raw: unknown,
): Promise<ActionResult<{ companyId: string; firmId: string }>> {
  return runAction(createCompanySchema, raw, async (input) => {
    const user = await requireUser();

    const result = await prisma.$transaction(async (tx) => {
      const duplicate = await tx.company.findFirst({
        where: { ownerId: user.id, name: input.companyName, deletedAt: null },
        select: { id: true },
      });

      if (duplicate) {
        throw new BusinessError("You already have a company with that name", {
          companyName: ["You already have a company with that name"],
        });
      }

      return provisionCompany(tx, {
        userId: user.id,
        companyName: input.companyName,
        gstin: input.gstin ?? null,
        stateCode: input.stateCode,
        addressLine1: input.addressLine1 ?? null,
        addressLine2: input.addressLine2 ?? null,
        city: input.city ?? null,
        pincode: input.pincode ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        fyStartMonth: input.fyStartMonth,
        isGstEnabled: input.isGstEnabled,
      });
    });

    // Open the new company straight away.
    await setActiveCompany(result.companyId);
    await setActiveFirm(result.firmId);

    revalidatePath("/companies");
    return result;
  });
}

/** Create or update a firm inside the active company (Settings > Firms). */
export async function saveFirmAction(raw: unknown): Promise<ActionResult<{ firmId: string }>> {
  return runAction(firmSchema, raw, async (input) => {
    const ctx = await requirePermission("firm.manage");
    const nameNormalized = normalizeName(input.name);

    const data = {
      name: input.name,
      nameNormalized,
      gstin: input.gstin ?? null,
      stateCode: input.stateCode,
      addressLine1: input.addressLine1 ?? null,
      addressLine2: input.addressLine2 ?? null,
      city: input.city ?? null,
      pincode: input.pincode ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      bankName: input.bankName ?? null,
      bankAccountNo: input.bankAccountNo ?? null,
      bankIfsc: input.bankIfsc ?? null,
      upiId: input.upiId ?? null,
      termsAndConditions: input.termsAndConditions ?? null,
    };

    const firmId = await prisma.$transaction(async (tx) => {
      // Scope by hand here: a transaction client cannot carry the extension.
      if (input.id) {
        const existing = await tx.firm.findFirst({
          where: { id: input.id, companyId: ctx.companyId, deletedAt: null },
          select: { id: true },
        });
        if (!existing) throw new BusinessError("That firm does not belong to this company");

        await tx.firm.update({ where: { id: existing.id }, data });

        if (input.isDefault) await makeDefault(tx, ctx.companyId, existing.id);
        return existing.id;
      }

      const created = await tx.firm.create({
        data: { ...data, companyId: ctx.companyId, isDefault: false },
        select: { id: true },
      });

      // A new firm needs its own number series from day one (D-20).
      await createNumberSequences(tx, ctx.companyId, created.id, ctx.fyStartMonth);

      if (input.isDefault) await makeDefault(tx, ctx.companyId, created.id);

      // More than one firm means the company is now multi-firm.
      const count = await tx.firm.count({
        where: { companyId: ctx.companyId, deletedAt: null, isActive: true },
      });
      if (count > 1) {
        await tx.company.update({
          where: { id: ctx.companyId },
          data: { isMultiFirm: true },
        });
      }

      return created.id;
    });

    revalidatePath("/settings/firms");
    return { firmId };
  });
}

async function makeDefault(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  companyId: string,
  firmId: string,
): Promise<void> {
  await tx.firm.updateMany({ where: { companyId }, data: { isDefault: false } });
  await tx.firm.update({ where: { id: firmId }, data: { isDefault: true } });
}

export async function deleteCompanyAction(companyId: string): Promise<ActionResult<{ ok: true }>> {
  return runActionRaw(async () => {
    const user = await requireUser();
    
    // Check if the user is the owner of the company
    const membership = await prisma.companyMember.findFirst({
      where: { userId: user.id, companyId: companyId, role: "OWNER" },
    });

    if (!membership) {
      throw new BusinessError("Only the owner can delete the company.");
    }

    await prisma.company.update({
      where: { id: companyId },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/companies");
    return { ok: true } as const;
  });
}

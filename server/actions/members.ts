"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth";
import { writeAudit } from "@/server/services/audit";
import { runAction, BusinessError, type ActionResult } from "@/server/guards/action";

const ROLES = ["OWNER", "ADMIN", "ACCOUNTANT", "SALESMAN"] as const;

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  name: z.string().trim().min(1, "Name is required").max(120),
  role: z.enum(ROLES).default("SALESMAN"),
  /** Temporary password for a brand-new account. */
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
});

/**
 * Grant someone access to this company.
 *
 * This is the one mechanism behind both "Accountant Access" in Utilities and
 * the "Companies Shared with Me" tab on the company picker (D-22).
 */
export async function inviteMemberAction(
  raw: unknown,
): Promise<ActionResult<{ userId: string; created: boolean }>> {
  return runAction(inviteSchema, raw, async (input) => {
    const ctx = await requirePermission("company.manage");

    if (input.role === "OWNER") {
      throw new BusinessError("A company has exactly one owner", {
        role: ["Choose Admin, Accountant or Salesman"],
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    let userId: string;
    let created = false;

    if (existingUser) {
      userId = existingUser.id;

      const alreadyMember = await prisma.companyMember.findUnique({
        where: { userId_companyId: { userId, companyId: ctx.companyId } },
        select: { id: true },
      });

      if (alreadyMember) {
        throw new BusinessError("That person already has access to this company", {
          email: ["Already a member"],
        });
      }
    } else {
      if (!input.password) {
        throw new BusinessError(
          "That email has no account yet. Set a temporary password for them.",
          { password: ["Set a temporary password"] },
        );
      }

      const user = await prisma.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash: await hashPassword(input.password),
        },
        select: { id: true },
      });

      userId = user.id;
      created = true;
    }

    await prisma.companyMember.create({
      data: {
        userId,
        companyId: ctx.companyId,
        role: input.role,
        acceptedAt: new Date(),
      },
    });

    await writeAudit(ctx, {
      entity: "CompanyMember",
      entityId: userId,
      action: "CREATE",
      after: { email: input.email, role: input.role },
    });

    revalidatePath("/settings/users");
    return { userId, created };
  });
}

const changeRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(ROLES),
});

export async function changeMemberRoleAction(
  raw: unknown,
): Promise<ActionResult<{ userId: string }>> {
  return runAction(changeRoleSchema, raw, async (input) => {
    const ctx = await requirePermission("company.manage");

    if (input.userId === ctx.user.id) {
      throw new BusinessError("You cannot change your own role");
    }
    if (input.role === "OWNER") {
      throw new BusinessError("Ownership cannot be granted from here");
    }

    const membership = await prisma.companyMember.findUnique({
      where: { userId_companyId: { userId: input.userId, companyId: ctx.companyId } },
      select: { id: true, role: true },
    });
    if (!membership) throw new BusinessError("That person is not a member of this company");
    if (membership.role === "OWNER") {
      throw new BusinessError("The owner's role cannot be changed");
    }

    await prisma.companyMember.update({
      where: { id: membership.id },
      data: { role: input.role },
    });

    await writeAudit(ctx, {
      entity: "CompanyMember",
      entityId: input.userId,
      action: "UPDATE",
      before: { role: membership.role },
      after: { role: input.role },
    });

    revalidatePath("/settings/users");
    return { userId: input.userId };
  });
}

export async function removeMemberAction(raw: unknown): Promise<ActionResult<{ userId: string }>> {
  return runAction(z.object({ userId: z.string().min(1) }), raw, async ({ userId }) => {
    const ctx = await requirePermission("company.manage");

    if (userId === ctx.user.id) {
      throw new BusinessError("You cannot remove yourself from the company");
    }

    const membership = await prisma.companyMember.findUnique({
      where: { userId_companyId: { userId, companyId: ctx.companyId } },
      select: { id: true, role: true },
    });
    if (!membership) throw new BusinessError("That person is not a member of this company");
    if (membership.role === "OWNER") throw new BusinessError("The owner cannot be removed");

    await prisma.companyMember.delete({ where: { id: membership.id } });

    await writeAudit(ctx, {
      entity: "CompanyMember",
      entityId: userId,
      action: "DELETE",
      before: { role: membership.role },
    });

    revalidatePath("/settings/users");
    return { userId };
  });
}

/** Members of the active company. */
export async function listMembers(companyId: string) {
  const members = await prisma.companyMember.findMany({
    where: { companyId },
    orderBy: { invitedAt: "asc" },
    select: {
      role: true,
      invitedAt: true,
      acceptedAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return members.map((m) => ({
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    invitedAt: m.invitedAt.toISOString(),
    accepted: !!m.acceptedAt,
  }));
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "./index";
import { prisma, forCompany, type ScopedPrisma } from "@/lib/db/prisma";
import { can, type Permission } from "./permissions";

export const ACTIVE_COMPANY_COOKIE = "bb_company";
export const ACTIVE_FIRM_COOKIE = "bb_firm";

export class AuthorizationError extends Error {
  constructor(message = "You do not have access to this") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  imageUrl: string | null;
}

export interface CompanyContext {
  user: SessionUser;
  companyId: string;
  companyName: string;
  role: Role;
  fyStartMonth: number;
  isGstEnabled: boolean;
  isMultiFirm: boolean;
  /** A Prisma client permanently bound to this company. */
  db: ScopedPrisma;
}

export interface FirmContext extends CompanyContext {
  firmId: string;
  firmName: string;
  firmStateCode: string;
  firmGstin: string | null;
}

/** The signed-in user, or null. Never redirects. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, imageUrl: true },
  });

  return user ?? null;
}

/** The signed-in user, or a redirect to the login page. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Every company the user can open, newest activity first (ref-12). */
export async function listUserCompanies(userId: string) {
  const memberships = await prisma.companyMember.findMany({
    where: { userId, company: { deletedAt: null } },
    select: {
      role: true,
      company: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          lastActivityAt: true,
          createdAt: true,
          isMultiFirm: true,
        },
      },
    },
  });

  return memberships
    .map((m) => ({ ...m.company, role: m.role, isOwner: m.company.ownerId === userId }))
    .sort((a, b) => {
      const aTime = (a.lastActivityAt ?? a.createdAt).getTime();
      const bTime = (b.lastActivityAt ?? b.createdAt).getTime();
      return bTime - aTime;
    });
}

/**
 * Resolve the active company from its cookie and verify membership.
 *
 * A cookie naming a company the user does not belong to is treated exactly
 * like no cookie at all: the user goes back to the company picker. There is
 * deliberately no fallback to "their first company" — silently opening a
 * different tenant than the one requested is how data gets mixed up.
 */
export async function getCompanyContext(): Promise<CompanyContext | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const jar = await cookies();
  const companyId = jar.get(ACTIVE_COMPANY_COOKIE)?.value;
  if (!companyId) return null;

  const membership = await prisma.companyMember.findUnique({
    where: { userId_companyId: { userId: user.id, companyId } },
    select: {
      role: true,
      company: {
        select: {
          id: true,
          name: true,
          fyStartMonth: true,
          isGstEnabled: true,
          isMultiFirm: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!membership || membership.company.deletedAt) return null;

  return {
    user,
    companyId: membership.company.id,
    companyName: membership.company.name,
    role: membership.role,
    fyStartMonth: membership.company.fyStartMonth,
    isGstEnabled: membership.company.isGstEnabled,
    isMultiFirm: membership.company.isMultiFirm,
    db: forCompany(membership.company.id),
  };
}

/** The active company, or a redirect to the picker. */
export async function requireCompany(): Promise<CompanyContext> {
  const user = await requireUser();
  const ctx = await getCompanyContext();
  if (!ctx) {
    const companies = await listUserCompanies(user.id);
    redirect(companies.length === 0 ? "/onboarding" : "/companies");
  }
  return ctx;
}

/**
 * The active company plus a firm.
 *
 * `firmId` may come from a form field, so it is always re-checked against the
 * active company: a firm id borrowed from another tenant is an authorization
 * error, never an empty result set.
 */
export async function requireFirm(firmId?: string | null): Promise<FirmContext> {
  const ctx = await requireCompany();
  const jar = await cookies();
  const requested = firmId ?? jar.get(ACTIVE_FIRM_COOKIE)?.value ?? null;

  const firm = requested
    ? await ctx.db.firm.findFirst({
        where: { id: requested, isActive: true },
        select: { id: true, name: true, stateCode: true, gstin: true },
      })
    : await ctx.db.firm.findFirst({
        where: { isActive: true },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: { id: true, name: true, stateCode: true, gstin: true },
      });

  if (!firm) {
    if (requested) {
      // Explicitly asked for a firm that this company does not own.
      throw new AuthorizationError("That firm does not belong to this company");
    }
    redirect("/onboarding");
  }

  return {
    ...ctx,
    firmId: firm.id,
    firmName: firm.name,
    firmStateCode: firm.stateCode,
    firmGstin: firm.gstin,
  };
}

/** Throw unless the active role holds the permission. */
export function assertPermission(ctx: CompanyContext, permission: Permission): void {
  if (!can(ctx.role, permission)) {
    throw new AuthorizationError(`Your role (${ctx.role}) cannot perform this action`);
  }
}

/** Company context with a permission already checked. */
export async function requirePermission(permission: Permission): Promise<CompanyContext> {
  const ctx = await requireCompany();
  assertPermission(ctx, permission);
  return ctx;
}

/** Firm context with a permission already checked. */
export async function requireFirmPermission(
  permission: Permission,
  firmId?: string | null,
): Promise<FirmContext> {
  const ctx = await requireFirm(firmId);
  assertPermission(ctx, permission);
  return ctx;
}

export async function setActiveCompany(companyId: string): Promise<void> {
  const jar = await cookies();
  jar.set(ACTIVE_COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  // The previous firm belongs to the previous company.
  jar.delete(ACTIVE_FIRM_COOKIE);
}

export async function setActiveFirm(firmId: string): Promise<void> {
  const jar = await cookies();
  jar.set(ACTIVE_FIRM_COOKIE, firmId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearActiveCompany(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACTIVE_COMPANY_COOKIE);
  jar.delete(ACTIVE_FIRM_COOKIE);
}

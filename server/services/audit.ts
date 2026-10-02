import type { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { CompanyContext } from "@/lib/auth/session";
import { parseSettings } from "@/lib/validators/settings";

export interface AuditInput {
  entity: string;
  entityId: string;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
  firmId?: string | null;
}

/**
 * Append an audit row.
 *
 * Honours the `Audit Trail` switch from the Settings screen (ref-11): when it
 * is off, nothing is written. Never throws — a failed audit write must not roll
 * back the business transaction that triggered it, so it is logged and
 * swallowed.
 */
export async function writeAudit(ctx: CompanyContext, input: AuditInput): Promise<void> {
  try {
    const row = await prisma.settings.findUnique({
      where: { companyId: ctx.companyId },
      select: {
        general: true,
        transaction: true,
        print: true,
        tax: true,
        party: true,
        item: true,
        message: true,
      },
    });

    if (!parseSettings(row).general.auditTrail) return;

    await prisma.auditLog.create({
      data: {
        companyId: ctx.companyId,
        firmId: input.firmId ?? null,
        userId: ctx.user.id,
        entity: input.entity,
        entityId: input.entityId,
        action: input.action,
        before: (input.before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (input.after ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    console.error("[audit] failed to write audit row:", error);
  }
}

/** Audit rows for the log screen, newest first. */
export async function listAuditLog(
  companyId: string,
  options: { entity?: string; entityId?: string; page?: number; pageSize?: number } = {},
) {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 50;

  const where = {
    companyId,
    ...(options.entity ? { entity: options.entity } : {}),
    ...(options.entityId ? { entityId: options.entityId } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        entity: true,
        entityId: true,
        action: true,
        at: true,
        user: { select: { name: true, email: true } },
      },
    }),
  ]);

  return {
    total,
    rows: rows.map((r) => ({
      id: r.id,
      entity: r.entity,
      entityId: r.entityId,
      action: r.action,
      at: r.at.toISOString(),
      userName: r.user?.name ?? "System",
    })),
  };
}

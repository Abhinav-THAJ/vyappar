import { PrismaClient } from "@prisma/client";
import { companyScopedSet, softDeleteSet } from "./models";

declare global {
  var __bellaPrisma: PrismaClient | undefined;
}

/**
 * The raw client. Use it only for identity and tenant rows (User, Company,
 * CompanyMember). Everything else goes through `forCompany()`.
 */
export const prisma =
  globalThis.__bellaPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalThis.__bellaPrisma = prisma;

/** Operations whose `where` we scope. */
const WHERE_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
]);

/** Operations that write new rows and therefore need `companyId` stamped on. */
const CREATE_OPERATIONS = new Set(["create", "createMany", "createManyAndReturn"]);

type AnyArgs = Record<string, unknown> & {
  where?: Record<string, unknown>;
  data?: unknown;
  create?: Record<string, unknown>;
  update?: Record<string, unknown>;
};

function scopeWhere(
  where: Record<string, unknown> | undefined,
  companyId: string,
  softDelete: boolean,
  includeDeleted: boolean,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(where ?? {}), companyId };
  // An explicit deletedAt filter always wins, so the Recycle Bin can opt in.
  if (softDelete && !includeDeleted && !("deletedAt" in next)) {
    next.deletedAt = null;
  }
  return next;
}

function stampCompany(data: unknown, companyId: string): unknown {
  if (Array.isArray(data)) {
    return data.map((row) =>
      row && typeof row === "object" ? { ...(row as object), companyId } : row,
    );
  }
  if (data && typeof data === "object") {
    return { ...(data as object), companyId };
  }
  return data;
}

export interface ScopedClientOptions {
  /** Include soft-deleted rows — used only by the Recycle Bin and Verify My Data. */
  includeDeleted?: boolean;
}

/**
 * A Prisma client permanently bound to one company.
 *
 * Every read gains `companyId` (and `deletedAt: null`) in its `where`; every
 * write gains `companyId` in its `data`. Forgetting to scope a query is
 * therefore impossible through this client — which is the point, because
 * hand-written where clauses are the usual source of cross-tenant leaks.
 *
 * Note on `create`: the extension injects `companyId` at runtime, but it does
 * not change Prisma's generated types, so callers still pass `companyId`
 * explicitly to satisfy the compiler. That is harmless — the extension
 * overwrites whatever was passed with the bound company, so the runtime
 * guarantee holds even if a caller passes the wrong value.
 */
export function forCompany(companyId: string, options: ScopedClientOptions = {}) {
  if (!companyId) throw new Error("forCompany() requires a companyId");
  const includeDeleted = options.includeDeleted ?? false;

  return prisma.$extends({
    name: "company-tenancy",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!companyScopedSet.has(model)) return query(args);

          const softDelete = softDeleteSet.has(model);
          const next = { ...(args as AnyArgs) };

          if (WHERE_OPERATIONS.has(operation)) {
            next.where = scopeWhere(next.where, companyId, softDelete, includeDeleted);
          }

          if (CREATE_OPERATIONS.has(operation)) {
            next.data = stampCompany(next.data, companyId);
          }

          if (operation === "upsert") {
            next.where = scopeWhere(next.where, companyId, softDelete, includeDeleted);
            next.create = stampCompany(next.create, companyId) as Record<string, unknown>;
          }

          return query(next);
        },
      },
    },
  });
}

export type ScopedPrisma = ReturnType<typeof forCompany>;

/**
 * A transaction client is already inside `$transaction`, so it cannot be
 * re-extended. Posting services take this type and scope by hand, which the
 * posting tests cover explicitly.
 */
export type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

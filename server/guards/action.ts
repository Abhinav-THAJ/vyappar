import { z } from "zod";
import { Prisma } from "@prisma/client";
import { AuthorizationError } from "@/lib/auth/session";

export type FieldErrors = Record<string, string[]>;

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(error: string, fieldErrors?: FieldErrors): ActionResult<T> {
  return { ok: false, error, fieldErrors };
}

/** A domain error whose message is safe to show the user. */
export class BusinessError extends Error {
  readonly fieldErrors?: FieldErrors;

  constructor(message: string, fieldErrors?: FieldErrors) {
    super(message);
    this.name = "BusinessError";
    this.fieldErrors = fieldErrors;
  }
}

function flatten(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/** Map a Prisma error to something a user can act on. */
function describePrismaError(error: Prisma.PrismaClientKnownRequestError): string {
  switch (error.code) {
    case "P2002": {
      const target = error.meta?.target;
      const fields = Array.isArray(target) ? target.join(", ") : String(target ?? "value");
      if (fields.includes("number")) {
        return "That number is already used for this document type in this financial year";
      }
      if (fields.includes("nameNormalized") || fields.includes("name")) {
        return "A record with that name already exists";
      }
      return `That ${fields} is already in use`;
    }
    case "P2003":
      return "This record is referenced elsewhere and cannot be changed";
    case "P2025":
      return "That record no longer exists";
    default:
      return "The database rejected this change";
  }
}

/**
 * Wrap a server action body: parse with Zod, run, and turn every throw into a
 * typed, user-safe result. Actions never leak a stack trace to the client.
 */
export async function runAction<S extends z.ZodTypeAny, TOutput>(
  schema: S,
  raw: unknown,
  handler: (input: z.output<S>) => Promise<TOutput>,
): Promise<ActionResult<TOutput>> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return fail("Please correct the highlighted fields", flatten(parsed.error));
  }

  try {
    return ok(await handler(parsed.data));
  } catch (error) {
    return toResult(error);
  }
}

/** Same error handling, without a schema — for actions that take no input. */
export async function runActionRaw<TOutput>(
  handler: () => Promise<TOutput>,
): Promise<ActionResult<TOutput>> {
  try {
    return ok(await handler());
  } catch (error) {
    return toResult(error);
  }
}

function toResult<T>(error: unknown): ActionResult<T> {
  // Next.js signals redirect() and notFound() by throwing; let those through.
  if (
    error &&
    typeof error === "object" &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    ((error as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
      (error as { digest: string }).digest === "NEXT_NOT_FOUND")
  ) {
    throw error;
  }

  if (error instanceof BusinessError) {
    return fail(error.message, error.fieldErrors);
  }
  if (error instanceof AuthorizationError) {
    return fail(error.message);
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return fail(describePrismaError(error));
  }
  if (error instanceof z.ZodError) {
    return fail("Please correct the highlighted fields", flatten(error));
  }

  console.error("[action] unhandled error:", error);
  return fail("Something went wrong. Please try again.");
}

"use server";

import { randomBytes, createHash } from "node:crypto";
import { AuthError } from "next-auth";
import { signIn, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validators/auth";
import { runAction, BusinessError, type ActionResult } from "@/server/guards/action";

/** Create an account and sign the new user straight in. */
export async function signupAction(raw: unknown): Promise<ActionResult<{ userId: string }>> {
  return runAction(signupSchema, raw, async (input) => {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (existing) {
      throw new BusinessError("An account with that email already exists", {
        email: ["An account with that email already exists"],
      });
    }

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        mobile: input.mobile,
        passwordHash: await hashPassword(input.password),
      },
      select: { id: true },
    });

    await signIn("credentials", {
      email: input.email,
      password: input.password,
      redirect: false,
    });

    return { userId: user.id };
  });
}

/** Sign in with email and password. */
export async function loginAction(raw: unknown): Promise<ActionResult<{ ok: true }>> {
  return runAction(loginSchema, raw, async (input) => {
    try {
      await signIn("credentials", {
        email: input.email,
        password: input.password,
        redirect: false,
      });
    } catch (error) {
      if (error instanceof AuthError) {
        // Never reveal whether it was the email or the password that was wrong.
        throw new BusinessError("Those credentials do not match an account");
      }
      throw error;
    }
    return { ok: true } as const;
  });
}

const RESET_TTL_MS = 60 * 60 * 1000; // one hour

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Start a password reset.
 *
 * Always reports success: telling an anonymous caller whether an email is
 * registered is an account-enumeration hole. In development the link is logged
 * to the server console; production wiring for email is a later phase.
 */
export async function forgotPasswordAction(raw: unknown): Promise<ActionResult<{ sent: true }>> {
  return runAction(forgotPasswordSchema, raw, async ({ email }) => {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });

    if (user) {
      const token = randomBytes(32).toString("hex");

      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token: hashToken(token),
          expiresAt: new Date(Date.now() + RESET_TTL_MS),
        },
      });

      const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      console.info(`[auth] Password reset link for ${email}: ${base}/reset-password/${token}`);
    }

    return { sent: true } as const;
  });
}

/** Complete a password reset and invalidate the token. */
export async function resetPasswordAction(raw: unknown): Promise<ActionResult<{ ok: true }>> {
  return runAction(resetPasswordSchema, raw, async (input) => {
    const record = await prisma.passwordResetToken.findUnique({
      where: { token: hashToken(input.token) },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BusinessError("That reset link has expired. Please request a new one.");
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash: await hashPassword(input.password) },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Any other outstanding link for this user is now void.
      prisma.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);

    return { ok: true } as const;
  });
}

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { loginSchema } from "@/lib/validators/auth";
import { authConfig } from "./config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: { id: true, name: true, email: true, passwordHash: true, imageUrl: true },
        });

        // Compare against a dummy hash when the user is missing so that a
        // wrong email and a wrong password take the same time to answer.
        const hash = user?.passwordHash ?? DUMMY_HASH;
        const ok = await bcrypt.compare(parsed.data.password, hash);
        if (!user || !ok) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.imageUrl,
        };
      },
    }),
  ],
});

/** bcrypt hash of a value no user can have; used only to equalise timing. */
const DUMMY_HASH = "$2a$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ012";

export const BCRYPT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

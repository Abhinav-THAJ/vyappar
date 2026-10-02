import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe half of the Auth.js config: no Prisma, no bcrypt.
 * `middleware.ts` imports this; `lib/auth/index.ts` extends it with providers.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30,
  },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.name = user.name ?? null;
        token.email = user.email ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

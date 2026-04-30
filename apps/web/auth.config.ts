import type { NextAuthConfig } from 'next-auth';
import type { Role } from '@painel/shared';

// Edge-safe NextAuth config — no Credentials provider, no Prisma,
// no ioredis. Used by middleware.ts so the Edge runtime doesn't try
// to bundle Node-only modules. Full config (with provider + DB) is
// declared in auth.ts and used by API routes / server components.

const EIGHT_HOURS = 8 * 60 * 60;

export const authConfig = {
  trustHost: true,
  session: { strategy: 'jwt', maxAge: EIGHT_HOURS, updateAge: 60 * 60 },
  pages: { signIn: '/login', error: '/login' },
  providers: [], // Real providers live in auth.ts
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: Role }).role;
      }
      return token;
    },
    session: async ({ session, token }) => {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      return session;
    },
  },
} satisfies NextAuthConfig;

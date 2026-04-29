import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { checkLoginRate, clearLoginRate } from '@/lib/rate-limit';
import type { Role } from '@painel/shared';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

class InvalidCredentialsError extends CredentialsSignin {
  override code = 'invalid_credentials';
}

class AccountInactiveError extends CredentialsSignin {
  override code = 'account_inactive';
}

class TooManyAttemptsError extends CredentialsSignin {
  override code = 'too_many_attempts';
}

const EIGHT_HOURS = 8 * 60 * 60;

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt', maxAge: EIGHT_HOURS, updateAge: 60 * 60 },
  pages: { signIn: '/login', error: '/login' },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'E-mail', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      authorize: async (raw) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) throw new InvalidCredentialsError();
        const { email, password } = parsed.data;

        const rate = await checkLoginRate(email);
        if (!rate.allowed) {
          await db.auditLog.create({
            data: { action: 'login.blocked', payload: { email, attempts: rate.attempts } },
          });
          throw new TooManyAttemptsError();
        }

        const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
        if (!user) throw new InvalidCredentialsError();
        if (!user.active) throw new AccountInactiveError();

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) {
          await db.auditLog.create({
            data: { userId: user.id, action: 'login.failed', payload: { email } },
          });
          throw new InvalidCredentialsError();
        }

        await clearLoginRate(email);
        await db.auditLog.create({
          data: { userId: user.id, action: 'login.success', payload: { email } },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as Role,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session: async ({ session, token }) => {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      return session;
    },
  },
});

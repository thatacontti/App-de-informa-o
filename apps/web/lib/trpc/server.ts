import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { Session } from 'next-auth';
import type { Role } from '@painel/shared';
import { auth } from '@/auth';
import { can, type Action, ForbiddenError } from '@/lib/permissions';

export interface TrpcContext {
  session: Session | null;
}

export async function createContext(): Promise<TrpcContext> {
  const session = (await auth()) as Session | null;
  return { session };
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        cause: error.cause instanceof Error ? error.cause.message : undefined,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { ...ctx, session: ctx.session, user: ctx.session.user } });
});

export const requireRole = (...roles: Role[]) =>
  protectedProcedure.use(({ ctx, next }) => {
    if (!roles.includes(ctx.user.role)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: `role ${ctx.user.role} not allowed` });
    }
    return next({ ctx });
  });

export const requireAction = (action: Action) =>
  protectedProcedure.use(({ ctx, next }) => {
    if (!can(ctx.user.role, action)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: new ForbiddenError(ctx.user.role, action).message,
      });
    }
    return next({ ctx });
  });

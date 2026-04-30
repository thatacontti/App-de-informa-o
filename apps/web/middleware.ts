import { NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';
import { actionForPath, can } from '@/lib/permissions';

// Use the Edge-safe authConfig — the full auth.ts pulls in Prisma and
// ioredis, both Node-only, which the middleware bundle can't ship.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthed = !!req.auth?.user;

  if (!isAuthed) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  const action = actionForPath(pathname);
  if (action && !can(req.auth!.user.role, action)) {
    const url = req.nextUrl.clone();
    url.pathname = '/forbidden';
    url.searchParams.set('action', action);
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  // Run on every route except API auth, Next internals, public files and login itself.
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|login|forbidden|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)'],
};

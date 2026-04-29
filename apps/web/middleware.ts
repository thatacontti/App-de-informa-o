import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { actionForPath, can } from '@/lib/permissions';

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
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
});

export const config = {
  // Run on every route except API auth, Next internals, public files and login itself.
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|login|forbidden|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)'],
};

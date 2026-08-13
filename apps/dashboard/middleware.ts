import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Protected dashboard routes requiring active user authentication
const PROTECTED_PREFIXES = [
  '/playground',
  '/knowledge',
  '/crawlers',
  '/jobs',
  '/members',
  '/widgets',
  '/audit-logs',
  '/settings',
  '/institution',
  '/profile',
];

// Guest-only authentication routes
const GUEST_ROUTES = ['/login', '/register', '/signup'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('access_token')?.value;
  const isAuthenticated = Boolean(token);

  // 1. Unauthenticated access to protected routes -> Redirect to /login
  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Authenticated user accessing guest auth pages (/login, /register, /signup) -> Redirect to /institution selection screen
  const isGuestRoute = GUEST_ROUTES.includes(pathname);
  if (isGuestRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/institution', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files & images
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

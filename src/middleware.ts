import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const getCurrentUrl = (req: NextRequest): string => {
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  const forwardedHost = req.headers.get('x-forwarded-host');
  const host = forwardedHost || req.headers.get('host');

  const baseUrl = `${proto}://${host}`;
  return `${baseUrl}${req.nextUrl.pathname}${req.nextUrl.search}`;
};

export async function middleware(req: NextRequest) {
  const response = NextResponse.next();
  const token = req.cookies.get('AuthToken')?.value;
  const { pathname } = req.nextUrl;

  const authRoutes = ['/signin'];

  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // Logged-in users hitting auth pages go to the dashboard
  if (token && isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Everything matched below except auth routes requires a token
  if (!token && !isAuthRoute) {
    const signinUrl = new URL(
      `/signin?redirect=${getCurrentUrl(req)}`,
      req.url
    );
    return NextResponse.redirect(signinUrl);
  }

  return response;
}

// New protected routes MUST be added to the matcher or they render unauthenticated.
export const config = {
  matcher: [
    '/signin',
    '/dashboard',
    '/assets/:path*',
    '/asset-categories/:path*',
    '/assignments/:path*',
    '/transfers/:path*',
    '/returns/:path*',
    '/physical-verification/:path*',
    '/maintenance/:path*',
    '/disposal/:path*',
    '/depreciation/:path*',
    '/reports/:path*',
    '/employees/:path*',
    '/locations/:path*',
    '/vendors/:path*',
    '/configuration/:path*',
    '/coming-soon',
  ],
};

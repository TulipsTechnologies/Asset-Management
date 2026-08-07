// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { isDevAuthBypass, isLocalHost } from '@/utils/constants';

/**
 * Resolve the shared HRM host the same way the client `getBaseUrl()` does:
 * localhost points at the dev HRM host, otherwise the request's own origin.
 */
const getBaseUrl = (req: NextRequest): string => {
  const host = req.headers.get('host');
  if (isLocalHost(host)) {
    return 'https://webdev.tulipshrm.com:4433';
  }
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host ?? ''}`;
};

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('AuthToken')?.value;

  if (!token) {
    // `nextUrl.pathname` excludes basePath in middleware — put it back, so
    // whatever we hand off as `redirect` lands inside the module again.
    const target = `${req.nextUrl.basePath}${req.nextUrl.pathname}${req.nextUrl.search}`;

    // On localhost there is no hub cookie to inherit — send to the local
    // token-paste screen instead of the remote sign-in.
    if (isDevAuthBypass(req.headers.get('host'))) {
      // Clone nextUrl so basePath (/asset-management) is preserved.
      const devUrl = req.nextUrl.clone();
      devUrl.pathname = '/dev-auth';
      devUrl.search = '';
      devUrl.searchParams.set('redirect', target);
      return NextResponse.redirect(devUrl);
    }

    const baseUrl = getBaseUrl(req);
    const currentUrl = `${baseUrl}${target}`;
    const signinUrl = `${baseUrl}${
      process.env.NEXT_PUBLIC_LOGOUT_URL
    }?redirect=${encodeURIComponent(currentUrl)}`;
    return NextResponse.redirect(signinUrl);
  }

  return NextResponse.next();
}

// New protected routes MUST be added to the matcher or they render unauthenticated.
// Unauthenticated requests are bounced to the central hub sign-in
// (getBaseUrl() + NEXT_PUBLIC_LOGOUT_URL), or to /dev-auth on localhost in dev.
export const config = {
  matcher: [
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

// src/proxy.ts
import { NextRequest, NextResponse } from 'next/server';
import { isDevAuthEnabled } from '@/utils/constants';

/**
 * The shared HRM hub, for the sign-in bounce only. Configured when the hub is
 * elsewhere (a developer machine); otherwise the request's own origin, which is
 * correct on every deployed host without knowing which one it is.
 */
const getHubBaseUrl = (req: NextRequest): string => {
  const configured = process.env.NEXT_PUBLIC_HUB_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${req.headers.get('host') ?? ''}`;
};

export async function proxy(req: NextRequest) {
  const token = req.cookies.get('AuthToken')?.value;

  if (!token) {
    // `nextUrl.pathname` excludes basePath here — put it back, so
    // whatever we hand off as `redirect` lands inside the module again.
    const target = `${req.nextUrl.basePath}${req.nextUrl.pathname}${req.nextUrl.search}`;

    // With no hub cookie to inherit, send to the local token-paste screen
    // instead of the remote sign-in. Enabled by configuration, not by host.
    if (isDevAuthEnabled()) {
      // Clone nextUrl so basePath (/asset-management) is preserved.
      const devUrl = req.nextUrl.clone();
      devUrl.pathname = '/dev-auth';
      devUrl.search = '';
      devUrl.searchParams.set('redirect', target);
      return NextResponse.redirect(devUrl);
    }

    const baseUrl = getHubBaseUrl(req);
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
// (the hub base + NEXT_PUBLIC_LOGOUT_URL), or to /dev-auth when NEXT_PUBLIC_DEV_AUTH=true.
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

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

const APP_HOME = '/dashboard';

const PUBLIC_ROUTES = new Set([
  '/',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/confirm-email',
]);

function isPublicRoute(pathname: string) {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  if (pathname.startsWith('/verify-email')) return true;
  if (pathname.startsWith('/api/auth/')) return true;
  return false;
}

const AUTH_ROUTES = new Set([
  '/login',
  '/signup',
  '/forgot-password',
]);

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      '[proxy] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_(ANON_KEY|PUBLISHABLE_DEFAULT_KEY)'
    );
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session (required for SSR auth to work)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Skip static assets and API routes (except auth API)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/brand') ||
    pathname.includes('.')
  ) {
    return supabaseResponse;
  }

  // Unauthenticated user trying to access protected route
  if (!user && !isPublicRoute(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated but unverified users should stay on verification flow.
  // Allow auth endpoints so users can sign out, resend verification, etc.
  if (
    user &&
    !pathname.startsWith('/confirm-email') &&
    !pathname.startsWith('/verify-email') &&
    !pathname.startsWith('/api/auth/')
  ) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email_verified')
      .eq('id', user.id)
      .single();

    if (!profileError && profile && profile.email_verified === false) {
      const url = request.nextUrl.clone();
      url.pathname = '/confirm-email';
      return NextResponse.redirect(url);
    }
  }

  // Authenticated user trying to access auth pages -> redirect to app
  if (user && AUTH_ROUTES.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = APP_HOME;
    return NextResponse.redirect(url);
  }

  // Authenticated users shouldn't land on the marketing homepage.
  if (user && pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = APP_HOME;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

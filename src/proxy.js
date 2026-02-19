import { NextResponse } from 'next/server';

import { ONBOARDING_STATES } from '@/lib/onboarding/state';
import { updateSession } from '@/lib/supabase/middleware';

const AUTH_ROUTES = new Set(['/signup', '/login']);

function isBypassedPath(pathname) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|css|js|map|txt|xml)$/i.test(pathname)
  );
}

function isDashboardRoute(pathname) {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

function isMarketsRoute(pathname) {
  return pathname === '/markets' || pathname.startsWith('/markets/');
}

function isMarketsBoardRoute(pathname) {
  return pathname === '/markets';
}

function isMarketsDetailRoute(pathname) {
  return pathname.startsWith('/markets/');
}

function isLeaderboardRoute(pathname) {
  return pathname === '/leaderboard' || pathname.startsWith('/leaderboard/');
}

function isSetupRoute(pathname) {
  return pathname === '/setup' || pathname.startsWith('/setup/');
}

function redirectWithCookies(baseResponse, destinationUrl) {
  const redirectResponse = NextResponse.redirect(destinationUrl);

  baseResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}

async function getOnboardingState(supabase, userId) {
  const { data, error } = await supabase
    .from('user_onboarding')
    .select('onboarding_state')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data?.onboarding_state ?? null;
}

export async function proxy(request) {
  const pathname = request.nextUrl.pathname;
  const editMode = request.nextUrl.searchParams.get('edit') === '1';

  if (isBypassedPath(pathname)) {
    return NextResponse.next();
  }

  const { response, supabase, user } = await updateSession(request);

  const setupRoute = isSetupRoute(pathname);
  const dashboardRoute = isDashboardRoute(pathname);
  const marketsRoute = isMarketsRoute(pathname);
  const marketsBoardRoute = isMarketsBoardRoute(pathname);
  const marketsDetailRoute = isMarketsDetailRoute(pathname);
  const leaderboardRoute = isLeaderboardRoute(pathname);
  const authRoute = AUTH_ROUTES.has(pathname);
  const protectedRoute = setupRoute || dashboardRoute || marketsDetailRoute || leaderboardRoute;

  if (!user) {
    if (protectedRoute) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.search = '';
      return redirectWithCookies(response, loginUrl);
    }

    return response;
  }

  if (!supabase) {
    return response;
  }

  const onboardingState = await getOnboardingState(supabase, user.id);
  const completed = onboardingState === ONBOARDING_STATES.COMPLETED;

  if ((dashboardRoute || marketsRoute || leaderboardRoute) && !completed) {
    if (marketsBoardRoute) {
      return response;
    }
    const categoriesUrl = request.nextUrl.clone();
    categoriesUrl.pathname = '/setup/categories';
    categoriesUrl.search = '';
    return redirectWithCookies(response, categoriesUrl);
  }

  if (setupRoute && completed && !editMode) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return redirectWithCookies(response, dashboardUrl);
  }

  if (authRoute) {
    const nextUrl = request.nextUrl.clone();
    nextUrl.pathname = completed ? '/dashboard' : '/setup/categories';
    nextUrl.search = '';
    return redirectWithCookies(response, nextUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

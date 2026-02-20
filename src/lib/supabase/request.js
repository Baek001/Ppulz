import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';

function parseBearerToken(request) {
  const header = request?.headers?.get?.('authorization') || '';
  if (!header.toLowerCase().startsWith('bearer ')) return '';
  return header.slice(7).trim();
}

export async function createRequestClient(request) {
  const cookieClient = await createServerClient();
  const {
    data: { user: cookieUser },
  } = await cookieClient.auth.getUser();

  if (cookieUser) {
    return { supabase: cookieClient, user: cookieUser, authMode: 'cookie' };
  }

  const accessToken = parseBearerToken(request);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!accessToken || !supabaseUrl || !supabaseAnonKey) {
    return { supabase: cookieClient, user: null, authMode: 'none' };
  }

  const bearerClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user: bearerUser },
  } = await bearerClient.auth.getUser();

  if (bearerUser) {
    return { supabase: bearerClient, user: bearerUser, authMode: 'bearer' };
  }

  return { supabase: cookieClient, user: null, authMode: 'none' };
}


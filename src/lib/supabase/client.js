import { createBrowserClient } from '@supabase/ssr';

let browserClient;

export function hasSupabasePublicEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function createClient() {
  // Hardcoded fallback for Cloudflare build env issue
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zphqsvbwuyeiwuwbznrl.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_6EaCYov5zNPDoEBi4An0gw_QKIMCgDe';

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase variables');
    // throw new Error(
    //   'Supabase 환경변수가 없습니다. NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정하세요.',
    // );
  }

  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }

  return browserClient;
}

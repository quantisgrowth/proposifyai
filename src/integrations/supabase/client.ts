import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const DEFAULT_SUPABASE_URL = "https://zeolvknpvkvwkidfdvnv.supabase.co";
const DEFAULT_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inplb2x2a25wdmt2d2tpZGZkdm52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1NTIxNjksImV4cCI6MjEwMjEyODE2OX0.6wmfP1nOTE6TFmPQVftsGWQvDSL-9PjnnJlBCAOZY_Y";

function createSupabaseClient() {
  const SUPABASE_URL = DEFAULT_SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = DEFAULT_SUPABASE_KEY;

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});

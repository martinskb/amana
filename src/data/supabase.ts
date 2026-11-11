import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type { SupabaseClient };

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configurado = Boolean(url && chave);

export const supabase: SupabaseClient = createClient(url || 'http://supabase-nao-configurado.invalid', chave || 'sem-chave', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

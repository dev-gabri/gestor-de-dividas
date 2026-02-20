import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();
const supabaseConfigErrorMessage =
  "Configuração ausente do Supabase. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.";
const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function createMissingConfigProxy() {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(supabaseConfigErrorMessage);
      },
    },
  ) as SupabaseClient;
}

export const supabase: SupabaseClient = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createMissingConfigProxy();

export function hasSupabaseConfig() {
  return supabaseConfigured;
}

export function getSupabaseConfigErrorMessage() {
  return supabaseConfigErrorMessage;
}

/**
 * Supabase client pra rodar no browser (Client Components, hooks).
 * Usa anon key — pra dados sensíveis o RLS protege.
 */
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

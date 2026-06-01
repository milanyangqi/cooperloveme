import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2";

export function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function serviceClient(): SupabaseClient {
  return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function requireUser(req: Request, supabase: SupabaseClient): Promise<User> {
  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    const authError = new Error("Missing bearer token");
    authError.name = "Unauthorized";
    throw authError;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    const authError = new Error("Invalid bearer token");
    authError.name = "Unauthorized";
    throw authError;
  }

  return data.user;
}

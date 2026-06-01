import { buildEntitlement } from "../_shared/entitlements.ts";
import { error, json, options } from "../_shared/cors.ts";
import { requireUser, serviceClient } from "../_shared/supabase.ts";

interface ProfileRow {
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  auth_provider: "email" | "google";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "GET") return error("Method not allowed", 405);

  try {
    const supabase = serviceClient();
    const user = await requireUser(req, supabase);

    const [{ data: profile, error: profileError }, entitlement] = await Promise.all([
      supabase
        .from("profiles")
        .select("email,display_name,avatar_url,auth_provider")
        .eq("user_id", user.id)
        .maybeSingle<ProfileRow>(),
      buildEntitlement(supabase, user.id)
    ]);

    if (profileError) throw profileError;

    return json({
      user: {
        id: user.id,
        email: profile?.email ?? user.email,
        displayName: profile?.display_name ?? user.user_metadata?.name,
        avatarUrl: profile?.avatar_url ?? user.user_metadata?.avatar_url,
        authProvider: profile?.auth_provider ?? (user.app_metadata?.provider === "google" ? "google" : "email"),
        createdAt: user.created_at
      },
      entitlement
    });
  } catch (cause) {
    const err = cause as Error;
    return error(err.message, err.name === "Unauthorized" ? 401 : 500);
  }
});

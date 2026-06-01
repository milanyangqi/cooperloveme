import Stripe from "https://esm.sh/stripe@18.0.0?target=denonext";
import { error, json, options } from "../_shared/cors.ts";
import { requireUser, requiredEnv, serviceClient } from "../_shared/supabase.ts";

const stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"), {
  apiVersion: "2026-02-25.clover",
  httpClient: Stripe.createFetchHttpClient()
});

interface BillingCustomerRow {
  stripe_customer_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "POST") return error("Method not allowed", 405);

  try {
    const supabase = serviceClient();
    const user = await requireUser(req, supabase);
    const priceId = requiredEnv("STRIPE_PRO_PRICE_ID");
    const successUrl = requiredEnv("STRIPE_SUCCESS_URL");
    const cancelUrl = requiredEnv("STRIPE_CANCEL_URL");

    const customerId = await getOrCreateCustomer(supabase, user.id, user.email ?? undefined);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      client_reference_id: user.id,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { supabase_user_id: user.id },
      subscription_data: {
        metadata: { supabase_user_id: user.id }
      }
    });

    return json({ id: session.id, url: session.url });
  } catch (cause) {
    const err = cause as Error;
    return error(err.message, err.name === "Unauthorized" ? 401 : 500);
  }
});

async function getOrCreateCustomer(
  supabase: ReturnType<typeof serviceClient>,
  userId: string,
  email?: string
): Promise<string> {
  const { data: existing, error: readError } = await supabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle<BillingCustomerRow>();

  if (readError) throw readError;
  if (existing?.stripe_customer_id) return existing.stripe_customer_id;

  const customer = await stripe.customers.create({
    email,
    metadata: { supabase_user_id: userId }
  });

  const { error: writeError } = await supabase.from("billing_customers").upsert(
    {
      user_id: userId,
      stripe_customer_id: customer.id,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  if (writeError) throw writeError;
  return customer.id;
}

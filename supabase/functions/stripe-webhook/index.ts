import Stripe from "https://esm.sh/stripe@18.0.0?target=denonext";
import { error, json, options } from "../_shared/cors.ts";
import { requiredEnv, serviceClient } from "../_shared/supabase.ts";

const stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"), {
  apiVersion: "2026-02-25.clover",
  httpClient: Stripe.createFetchHttpClient()
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return options();
  if (req.method !== "POST") return error("Method not allowed", 405);

  const signature = req.headers.get("stripe-signature");
  if (!signature) return error("Missing Stripe signature", 400);

  try {
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      requiredEnv("STRIPE_WEBHOOK_SECRET"),
      undefined,
      Stripe.createSubtleCryptoProvider()
    );

    await handleEvent(event);
    return json({ received: true });
  } catch (cause) {
    const err = cause as Error;
    return error(err.message, 400);
  }
});

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await syncCheckoutSession(session);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    }
    default:
      break;
  }
}

async function syncCheckoutSession(session: Stripe.Checkout.Session): Promise<void> {
  const customerId = asId(session.customer);
  const userId = session.client_reference_id ?? session.metadata?.supabase_user_id;
  const subscriptionId = asId(session.subscription);

  if (!customerId || !userId) return;

  const supabase = serviceClient();
  const { error: customerError } = await supabase.from("billing_customers").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );
  if (customerError) throw customerError;

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await syncSubscription(subscription);
  }
}

async function syncSubscription(subscription: Stripe.Subscription): Promise<void> {
  const customerId = asId(subscription.customer);
  if (!customerId) return;

  const supabase = serviceClient();
  const metadataUserId = subscription.metadata?.supabase_user_id;
  const userId = metadataUserId ?? (await findUserIdByCustomer(supabase, customerId));
  if (!userId) return;

  const now = new Date().toISOString();
  const firstItem = subscription.items.data[0];
  const status = subscription.status;

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: firstItem?.price?.id ?? null,
      plan: "pro",
      status,
      current_period_start: toIso((subscription as unknown as { current_period_start?: number }).current_period_start),
      current_period_end: toIso((subscription as unknown as { current_period_end?: number }).current_period_end),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: now
    },
    { onConflict: "stripe_subscription_id" }
  );

  if (error) throw error;
}

async function findUserIdByCustomer(
  supabase: ReturnType<typeof serviceClient>,
  customerId: string
): Promise<string | undefined> {
  const { data, error: readError } = await supabase
    .from("billing_customers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle<{ user_id: string }>();

  if (readError) throw readError;
  return data?.user_id;
}

function asId(value: string | { id: string } | null): string | undefined {
  if (!value) return undefined;
  return typeof value === "string" ? value : value.id;
}

function toIso(seconds?: number): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

import "server-only";

import Stripe from "stripe";
import { getServerEnv } from "@/lib/env";

let client: Stripe | undefined;

export function isStripeConfigured(): boolean {
  return Boolean(getServerEnv().STRIPE_SECRET_KEY);
}

/** Server-only Stripe client. Throws a clear error when the secret key is missing. */
export function getStripe(): Stripe {
  const key = getServerEnv().STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  client ??= new Stripe(key, {
    typescript: true,
    appInfo: { name: "Guideless Tours", url: "https://guidelesstravel.com" },
  });
  return client;
}

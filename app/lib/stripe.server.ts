import "dotenv/config";
import Stripe from "stripe";

let _stripe: Stripe | null = null;

export class StripeNotConfiguredError extends Error {
  status = 503;
  constructor(message = "Stripe is not configured yet.") {
    super(message);
  }
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new StripeNotConfiguredError(
      "STRIPE_SECRET_KEY is not set. Add Stripe keys to .env to enable checkout.",
    );
  }
  _stripe = new Stripe(key, { typescript: true });
  return _stripe;
}

export function publicUrl(): string {
  return process.env.PUBLIC_URL ?? "http://localhost:5173";
}

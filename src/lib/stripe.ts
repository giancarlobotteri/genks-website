import "server-only";
import Stripe from "stripe";
import { requireEnv } from "@/lib/env";

export function getStripe() {
  return new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
    apiVersion: "2025-08-27.basil",
    typescript: true,
  });
}

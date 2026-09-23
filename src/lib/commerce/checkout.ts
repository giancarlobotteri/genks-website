import "server-only";
import type { LicenseTier } from "@/types/domain";

export interface CheckoutRequest {
  beatId: string;
  licenseId: LicenseTier;
}
export type CheckoutResult =
  | { status: "unavailable"; reason: string }
  | { status: "ready"; redirectUrl: string };
export interface CheckoutGateway {
  createSession(request: CheckoutRequest): Promise<CheckoutResult>;
}

/** Replace with server-side authorization, price validation and a payment provider in a later milestone. */
export const checkoutGateway: CheckoutGateway = {
  async createSession() {
    return {
      status: "unavailable",
      reason: "This demo does not accept payments.",
    };
  },
};

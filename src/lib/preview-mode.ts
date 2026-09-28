// Private until the owner explicitly approves a public launch and live payments.
export const privatePreview = process.env.GENKS_PRIVATE_PREVIEW !== "false";

export function stripeTestMode() {
  return process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") === true;
}

export function previewRecipientAllowed(email: string) {
  return !privatePreview || email.trim().toLowerCase() ===
    (process.env.GENKS_ADMIN_EMAIL || "prod.genks@gmail.com").trim().toLowerCase();
}

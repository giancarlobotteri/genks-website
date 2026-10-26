// Private until the owner explicitly approves a public launch and live payments.
export const privatePreview = process.env.GENKS_PRIVATE_PREVIEW !== "false";

export function stripeTestMode() {
  return /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY??"");
}

export function previewRecipientAllowed(email: string) {
  return !privatePreview || email.trim().toLowerCase() ===
    (process.env.GENKS_ADMIN_EMAIL || "prod.genks@gmail.com").trim().toLowerCase();
}

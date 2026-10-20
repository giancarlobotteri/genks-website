// Re-enable online checkout only through an explicit deployment configuration.
export const studioCashOnly = process.env.NEXT_PUBLIC_GENKS_PAYMENT_MODE !== "online";
export const studioPaymentMessage = "Pagamento in contanti presso lo studio. Al momento i pagamenti online con carta non sono disponibili.";
export function studioBeatHref(beat: { slug: string }) {
  return `/services/beat?${new URLSearchParams({ beat: beat.slug })}`;
}

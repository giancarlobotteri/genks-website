// Re-enable online checkout only through an explicit deployment configuration.
export const studioCashOnly = process.env.NEXT_PUBLIC_GENKS_PAYMENT_MODE !== "online";
export const studioPaymentMessage = "Mix, master e pacchetti senza ore di studio: paghi online con carta o Apple Pay. Registrazione e pacchetti con ore di studio: paghi in studio.";
export function studioBeatHref(beat: { slug: string }) {
  return `/services/beat?${new URLSearchParams({ beat: beat.slug })}`;
}

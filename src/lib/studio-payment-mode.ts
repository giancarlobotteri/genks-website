// Re-enable online checkout only through an explicit deployment configuration.
export const studioCashOnly = process.env.NEXT_PUBLIC_GENKS_PAYMENT_MODE !== "online";
export const studioPaymentMessage = "Mix, master, registrazione e pacchetti: carta o Apple Pay online, oppure contanti per il lavoro in studio.";
export function studioBeatHref(beat: { slug: string }) {
  return `/services/beat?${new URLSearchParams({ beat: beat.slug })}`;
}

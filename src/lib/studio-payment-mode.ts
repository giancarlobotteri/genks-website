// Re-enable online checkout only through an explicit deployment configuration.
export const studioCashOnly = process.env.NEXT_PUBLIC_GENKS_PAYMENT_MODE !== "online";
export const studioPaymentMessage = "Beat e registrazioni: pagamento in contanti presso lo studio. Per mix e master, modalità e pagamento sono indicati nel modulo.";
export function studioBeatHref(beat: { slug: string }) {
  return `/services/beat?${new URLSearchParams({ beat: beat.slug })}`;
}

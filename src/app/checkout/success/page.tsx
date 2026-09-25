import Link from "next/link";
import { z } from "zod";
import { ensureOrderConfirmationEmail } from "@/lib/order-confirmation";

export default async function SuccessPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const orderId = z.uuid().safeParse((await searchParams).order);
  if (orderId.success) {
    await ensureOrderConfirmationEmail(orderId.data).catch(() => undefined);
  }
  return <div className="portal-shell narrow-shell"><span className="eyebrow">PAYMENT RECEIVED</span><h1>Welcome to your next sound.</h1><p className="muted">Stripe is confirming the payment. Your Library updates after the verified webhook arrives.</p><Link className="button button-primary" href="/account/library">OPEN LIBRARY</Link></div>;
}

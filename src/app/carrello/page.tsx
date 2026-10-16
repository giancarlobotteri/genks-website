import type { Metadata } from "next";
import { CartPage } from "@/components/commerce/cart-page";
export const metadata: Metadata = { title: "Carrello", robots: { index: false, follow: false } };
export default async function Page({searchParams}:{searchParams:Promise<{cancelled?:string}>}) { const q=await searchParams;return <>{q.cancelled&&<p className="notice checkout-cancelled" role="status">Hai lasciato il pagamento. La selezione è ancora nel carrello: puoi controllarla e riprendere quando vuoi. Se hai già ricevuto una conferma di addebito, controlla prima la tua raccolta.</p>}<CartPage /></>; }

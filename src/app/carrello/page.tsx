import type { Metadata } from "next";
import { CartPage } from "@/components/commerce/cart-page";
export const metadata: Metadata = { title: "Carrello" };
export default function Page() { return <CartPage />; }

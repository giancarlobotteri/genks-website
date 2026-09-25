import { CalendarDays, Instagram, Sparkles } from "lucide-react";
import { site } from "@/config/site";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Promotion = {
  code: string;
  discount_type: "percent" | "fixed";
  amount: number;
  expires_at: string | null;
};

function TikTokIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.6 3c.2 1.7 1.2 3.1 2.7 3.9a6.6 6.6 0 0 0 2.7.7v3.1a9.5 9.5 0 0 1-5.4-1.8v7.3a6.2 6.2 0 1 1-5.3-6.1v3.2a3.1 3.1 0 1 0 2.2 3V3h3.1Z" /></svg>;
}

async function getActivePromotions(): Promise<Promotion[]> {
  if (!process.env.SUPABASE_SECRET_KEY || !(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_GENKS_SUPABASE_URL)) return [];
  try {
    const { data } = await createSupabaseAdminClient()
      .from("promo_codes")
      .select("code,discount_type,amount,expires_at")
      .eq("active", true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("created_at", { ascending: false })
      .limit(2);
    return (data ?? []) as Promotion[];
  } catch {
    return [];
  }
}

function TickerContent({ date, promotions, duplicate = false }: { date: string; promotions: Promotion[]; duplicate?: boolean }) {
  return <div className="announcement-group" aria-hidden={duplicate || undefined}>
    <span className="announcement-date"><CalendarDays size={17} /> <strong>{date}</strong></span>
    <i />
    {promotions.length ? promotions.map((promo) => <span className="promotion-chip" key={promo.code}>
      <Sparkles size={16} /> CODICE <strong>{promo.code}</strong> · {promo.discount_type === "percent" ? `${promo.amount}% DI SCONTO` : `€${(promo.amount / 100).toFixed(0)} DI SCONTO`}
    </span>) : <span className="promotion-placeholder"><Sparkles size={16} /> PROMOZIONI E CODICI SCONTO PUBBLICATI QUI</span>}
    <i />
    <a href={site.instagram} target="_blank" rel="noreferrer" tabIndex={duplicate ? -1 : undefined}>
      <Instagram size={18} /> INSTAGRAM <strong>@PRODBYGENKS</strong>
    </a>
    <i />
    <a href={site.tiktok} target="_blank" rel="noreferrer" tabIndex={duplicate ? -1 : undefined}>
      <TikTokIcon /> TIKTOK <strong>@PRODBYGENKS</strong>
    </a>
    <i />
  </div>;
}

export async function AnnouncementTicker() {
  const promotions = await getActivePromotions();
  const date = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date()).toLocaleUpperCase("it-IT");
  return <div className="frequency-strip announcement-ticker" aria-label="Data, promozioni e profili social GENKS">
    <div className="frequency-track">
      <TickerContent date={date} promotions={promotions} />
      <TickerContent date={date} promotions={promotions} duplicate />
    </div>
  </div>;
}

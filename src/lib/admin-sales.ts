import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SaleOrder } from "@/lib/sales";
export async function getSalesOrders() {
  const db=createSupabaseAdminClient(); const orders:SaleOrder[]=[];
  for(let offset=0;;offset+=500) {
    const {data,error}=await db.from("orders").select("id,order_number,customer_email,customer_name,status,total_cents,subtotal_cents,discount_cents,currency,paid_at,created_at,refunded_at,order_items(beat_title_snapshot,license_name_snapshot,unit_price_cents)").order("created_at",{ascending:false}).order("id").range(offset,offset+499);
    if(error)throw new Error("Impossibile caricare i dati delle vendite.");
    orders.push(...(data??[]) as SaleOrder[]); if(!data||data.length<500)break;
  }
  return orders;
}

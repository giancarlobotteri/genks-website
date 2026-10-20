import "server-only";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SaleOrder } from "@/lib/sales";
import type { BusinessSale, BusinessCost, RefundMovement, SaleKind } from "@/lib/business-sales";
export async function getSalesOrders() {
  await requireAdmin();
  const db=createSupabaseAdminClient(); const orders:SaleOrder[]=[];
  for(let offset=0;;offset+=500) {
    const {data,error}=await db.from("orders").select("id,order_number,customer_email,customer_name,status,total_cents,subtotal_cents,discount_cents,currency,paid_at,created_at,refunded_at,order_items(beat_title_snapshot,license_name_snapshot,unit_price_cents)").order("created_at",{ascending:false}).order("id").range(offset,offset+499);
    if(error)throw new Error("Impossibile caricare i dati delle vendite.");
    orders.push(...(data??[]) as SaleOrder[]); if(!data||data.length<500)break;
  }
  return orders;
}

export async function getBusinessSales(live = true) {
  await requireAdmin();
  const db = createSupabaseAdminClient();
  const sales: BusinessSale[] = [];
  const refunds: RefundMovement[] = [];
  const costs: BusinessCost[] = [];
  for (let offset=0;;offset+=500) {
    const {data,error}=await db.from("payments").select("id,provider_payment_id,order_id,booking_id,project_id,amount_cents,refunded_cents,fee_cents,currency,paid_at,created_at,livemode,review_reason,disputed,orders(order_number,customer_email,customer_name,order_items(beat_title_snapshot,license_name_snapshot)),bookings(reference,name,email),service_projects(reference,name,email,service,track_title)")
      .eq("livemode",live).in("status",["succeeded","refunded"]).order("created_at",{ascending:false}).order("id").range(offset,offset+499);
    if(error)throw new Error("Impossibile caricare il registro dei pagamenti.");
    for(const row of data??[]) {
      const order=Array.isArray(row.orders)?row.orders[0]:row.orders;
      const booking=Array.isArray(row.bookings)?row.bookings[0]:row.bookings;
      const project=Array.isArray(row.service_projects)?row.service_projects[0]:row.service_projects;
      sales.push({id:row.id,reference:order?.order_number??booking?.reference??project?.reference??row.provider_payment_id,
        customer:order?.customer_name??booking?.name??project?.name??"Cliente",email:order?.customer_email??booking?.email??project?.email??"",
        kind:row.order_id?"beat":row.booking_id?"recording":(project?.service??"mix_master") as SaleKind,
        amount:row.amount_cents,refunded:row.refunded_cents,fee:row.fee_cents,currency:row.currency,paidAt:row.paid_at??row.created_at,live:row.livemode,
        review:row.review_reason,disputed:row.disputed,providerId:row.provider_payment_id,
        targetUrl:row.order_id?"/admin/orders":row.booking_id?"/admin/bookings":"/admin/projects",
        items:order?.order_items?.map(i=>`${i.beat_title_snapshot} · ${i.license_name_snapshot}`)??(project?[project.track_title]:["Sessione di registrazione"]),
      });
    }
    if(!data||data.length<500)break;
  }
  // Paginate every source instead of silently dropping records past the API limit.
  for(let offset=0;;offset+=500) {
    const result=await db.from("payment_adjustments").select("payment_id,amount_cents,occurred_at").order("provider_refund_id").range(offset,offset+499);
    if(result.error)throw new Error("Impossibile leggere i rimborsi.");
    refunds.push(...result.data??[]);if(!result.data||result.data.length<500)break;
  }
  if(live)for(let offset=0;;offset+=500) {
    const result=await db.from("business_costs").select("id,description,amount_cents,incurred_on,category").order("incurred_on",{ascending:false}).order("id").range(offset,offset+499);
    if(result.error)throw new Error("Impossibile leggere i costi.");
    costs.push(...result.data??[]);if(!result.data||result.data.length<500)break;
  }
  return {sales,refunds,costs};
}

import { validBusinessDate } from "@/lib/sales-period";
import { requireAdmin } from "@/lib/auth";
import { getBusinessSales } from "@/lib/admin-sales";
import { filterBusinessSales, salesCsv } from "@/lib/business-sales";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  await requireAdmin();
  const query=new URL(request.url).searchParams;
  const {sales}=await getBusinessSales(query.get("mode")!=="test",query.get("archive")==="1");
  const selected=filterBusinessSales(sales,{day:query.get("day")??undefined,kind:query.get("kind")??undefined,status:query.get("status")??undefined,from:validBusinessDate(query.get("from")??undefined)?query.get("from")!:undefined,to:validBusinessDate(query.get("to")??undefined)?query.get("to")!:undefined});
  return new Response(salesCsv(selected),{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=GENKS-vendite.csv","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}


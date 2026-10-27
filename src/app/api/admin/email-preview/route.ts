import { requireAdmin } from "@/lib/auth";
import { renderGenksStudioEmail } from "@/lib/email-design";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  await requireAdmin();
  const audience=new URL(request.url).searchParams.get('audience')==='owner'?'owner':'customer';
  const {serviceEmailSummary}=await import('@/lib/service-email-summary');
  const html=renderGenksStudioEmail(serviceEmailSummary({reference:'PRJ-ANTEPRIMA',total:3998,paid:1999,name:'Artista di esempio',artistName:'Artista',email:'artista@example.invalid'},audience));
  return new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow, noarchive","X-Content-Type-Options":"nosniff"}});
}


import {cinematicOriginAllowed} from "@/lib/cinematic-origin";
import {quoteCinematicOrder} from '@/lib/cinematic-order';
export async function POST(request: Request) {
  if (!cinematicOriginAllowed(request)) return Response.json({error:"Origine non autorizzata."},{status:403});
  try {
    const body = await request.text();
    if (body.length > 30000) return Response.json({error:'Richiesta troppo grande.'},{status:413});
    const input = JSON.parse(body);
    return Response.json(quoteCinematicOrder(input, Boolean(input.earlyStart)), {headers:{'Cache-Control':'no-store'}});
  } catch {
    return Response.json({error:'Controlla il servizio, gli orari e i file richiesti.'},{status:400});
  }
}

import {z} from 'zod';
import {quotePreventivo} from '@/lib/chatbot/checkout';
import {allowPublicRequest} from '@/lib/security/request-limit';
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Richiesta non autorizzata.'},{status:403});
 if(!await allowPublicRequest('quote'))return Response.json({error:'Attendi qualche minuto.'},{status:429});
 try{const text=await request.text();if(text.length>50000)throw Error('Richiesta troppo grande.');const data=z.object({code:z.string().max(16000),details:z.unknown(),payment:z.enum(['card','cash']),early:z.boolean()}).parse(JSON.parse(text));return Response.json({quote:quotePreventivo(data.code,data.details,data.payment,data.early)});}catch{return Response.json({error:'Controlla preventivo, date e file.'},{status:400});}
}

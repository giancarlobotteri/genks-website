import {z} from 'zod';
import {verifyResendSignature} from '@/lib/security/resend-signature';
import {receiveSupportAlert} from '@/lib/support-inbox';
export const runtime='nodejs';
export async function POST(request:Request){
 const secret=process.env.GENKS_RESEND_WEBHOOK_SECRET;if(!secret)return new Response('Non configurato',{status:503});
 const raw=await request.text();if(raw.length>131072)return new Response('Richiesta troppo grande',{status:413});
 if(!verifyResendSignature(raw,{id:request.headers.get('svix-id'),timestamp:request.headers.get('svix-timestamp'),signature:request.headers.get('svix-signature')},secret))return new Response('Firma non valida',{status:401});
 let body:unknown;try{body=JSON.parse(raw);}catch{return new Response('Dati non validi',{status:400});}
 const event=z.object({type:z.string(),data:z.unknown()}).safeParse(body);if(!event.success)return new Response('Dati non validi',{status:400});if(event.data.type!=='email.received')return Response.json({ignored:true});
 const mail=z.object({email_id:z.uuid(),to:z.array(z.string().max(500)).max(100),from:z.string().max(500),subject:z.string().max(2000)}).safeParse(event.data.data);
 if(!mail.success)return new Response('Dati non validi',{status:400});
 try{return Response.json({received:await receiveSupportAlert(mail.data)});}catch{return new Response('Avviso da riprovare',{status:503});}
}

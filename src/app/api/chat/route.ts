import {z} from 'zod';
import {SYSTEM_PROMPT} from '@/lib/chatbot/prompt';
import {calcolaPreventivo,PREVENTIVO_TOOL} from '@/lib/chatbot/pricing';
import {quoteInputSchema} from '@/lib/chatbot/checkout';
import {BOOKING_TOOL,availableBookingLinks} from '@/lib/chatbot/booking';
import {allowPublicRequest} from '@/lib/security/request-limit';
export const runtime='nodejs';
export const maxDuration=60;
const fallback='L’assistente automatico non è attivo in questo momento. Puoi [scegliere un servizio](https://www.prodbygenks.com/services) o [scrivere a GENKS](https://wa.me/393450236299).';
const schema=z.object({messages:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().trim().min(1).max(1000)}).strict()).min(1).max(12)}).strict();
type Part={text?:string;functionCall?:{name:string;args?:unknown};[key:string]:unknown};
type Content={role:'model'|'user';parts:Part[]};
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Richiesta non autorizzata.'},{status:403});
 if(!await allowPublicRequest('chat'))return Response.json({reply:'Hai inviato molte richieste. Riprova tra qualche minuto.'},{status:429});
 try{
  const text=await request.text();if(text.length>20000)return Response.json({error:'Messaggio troppo lungo.'},{status:413});
  const {messages}=schema.parse(JSON.parse(text));if(messages[0].role!=='user'||messages.at(-1)?.role!=='user')throw Error('messages');
  if(messages.some(m=>/[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\s().-]*){8,}|https?:\/\//i.test(m.role==='user'?m.content:'')))return Response.json({reply:'Non inserire email, telefoni, collegamenti ai file o dati personali in chat. Per il tuo ordine usa [l’assistenza](https://www.prodbygenks.com/account) oppure [WhatsApp](https://wa.me/393450236299).'});
  // Explicit activation gate: adding a key must never silently activate the public provider.
  const key=process.env.GEMINI_API_KEY;
  if(process.env.GENKS_GEMINI_ENABLED!=='true'||!key)return Response.json({reply:fallback,active:false});
  const contents:Content[]=messages.map(m=>({role:m.role==='user'?'user':'model',parts:[{text:m.content}]}));
  const deadline=AbortSignal.timeout(50000);
  for(let step=0;step<3;step++){
   if(!await allowPublicRequest('chat-provider'))return Response.json({reply:fallback});
   const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({systemInstruction:{parts:[{text:SYSTEM_PROMPT+'\nData e ora attuali italiane: '+new Date().toLocaleString('it-IT',{timeZone:'Europe/Rome'})}]},contents,tools:[{functionDeclarations:[PREVENTIVO_TOOL,BOOKING_TOOL]}],generationConfig:{temperature:.3,maxOutputTokens:900}}),signal:deadline});
   if(!response.ok){console.error('[chat] provider status',response.status);return Response.json({reply:fallback});}
   const data=await response.json();const parts:Part[]=data?.candidates?.[0]?.content?.parts??[];const calls=parts.filter(p=>p.functionCall);
   if(!calls.length){const reply=parts.filter(p=>!p.thought).map(p=>p.text??'').join('').trim();return Response.json({reply:reply.slice(0,6000)||fallback,active:true});}
   if(calls.length>4)throw Error('tool_limit');
   contents.push({role:'model',parts});
   const results:Part[]=[];
   for(const call of calls){const {name,args}=call.functionCall!;let result:unknown;try{result=name===PREVENTIVO_TOOL.name?calcolaPreventivo(quoteInputSchema.parse(args)):name===BOOKING_TOOL.name?await availableBookingLinks(args):{errore:'Strumento sconosciuto'};}catch{result={errore:'Richiesta non valida o disponibilità non verificabile. Non inventare risultati: rimanda alla pagina dei servizi.'};}results.push({functionResponse:{name,response:{result}}});}
   contents.push({role:'user',parts:results});
  }
  return Response.json({reply:fallback});
 }catch{return Response.json({reply:'Non riesco a elaborare questa richiesta. Riprova con un messaggio breve sui servizi GENKS.'},{status:400});}
}

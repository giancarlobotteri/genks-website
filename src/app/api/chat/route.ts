import {recordingHoursOnly} from '@/lib/chatbot/booking-request';
import {projectIntake} from '@/lib/chatbot/project-intake';
import {calcolaPreventivo} from '@/lib/chatbot/pricing';
import {formatQuote} from '@/lib/chatbot/quote-request';
import {answerBookingRequest} from '@/lib/chatbot/booking';
import {knownAnswer} from '@/lib/chatbot/answers';
import {z} from 'zod';
import {rispondi} from '@/lib/chatbot/providers';
import {allowPublicRequest} from '@/lib/security/request-limit';
export const runtime='nodejs';
export const maxDuration=60;
const fallback='L’assistente automatico non è attivo in questo momento. Puoi [scegliere un servizio](https://www.prodbygenks.com/services) o [scrivere a GENKS](https://www.instagram.com/prodbygenks/).';
const schema=z.object({messages:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().trim().min(1).max(1000)}).strict()).min(1).max(12)}).strict();
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Richiesta non autorizzata.'},{status:403});
 if(!await allowPublicRequest('chat'))return Response.json({reply:'Hai inviato molte richieste. Riprova tra qualche minuto.'},{status:429});
 try{
  const text=await request.text();if(text.length>20000)return Response.json({error:'Messaggio troppo lungo.'},{status:413});
  const {messages}=schema.parse(JSON.parse(text));if(messages[0].role!=='user'||messages.at(-1)?.role!=='user')throw Error('messages');
  if(/\b(?:il mio|mio)\s+(?:numero|telefono)\b/i.test(messages.at(-1)?.content??''))return Response.json({reply:'Non inserire dati personali in chat. Per parlare con GENKS usa [DM Instagram](https://www.instagram.com/prodbygenks/) o assistenza@prodbygenks.com.'});
  const privateText=(value:string)=>/[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\s().-]*){8,}|https?:\/\/|\b(?:il mio|mio)\s+(?:numero|telefono)\b/i.test(value);
  if(privateText(messages.at(-1)!.content))return Response.json({reply:'Non inserire email, telefoni, collegamenti ai file o dati personali in chat. Per il tuo ordine usa [l’assistenza](https://www.prodbygenks.com/account) oppure [DM Instagram](https://www.instagram.com/prodbygenks/).'});
  const safeMessages=messages.map(m=>m.role==='user'&&privateText(m.content)?{...m,content:'[Messaggio precedente con dati personali omesso]'}:m);
  const known=knownAnswer(messages.at(-1)!.content);if(known)return Response.json({reply:known,active:true});
  const hours=recordingHoursOnly(messages.at(-1)!.content);if(hours){const input={ore_registrazione:hours};return Response.json({reply:formatQuote(input,calcolaPreventivo(input),messages.at(-1)!.content),active:true});}
  const booking=await answerBookingRequest(messages.at(-1)!.content);if(booking)return Response.json({reply:booking,active:true});
  if(!process.env.CLOUDFLARE_ACCOUNT_ID||!process.env.CLOUDFLARE_API_TOKEN)return Response.json({reply:fallback,active:false});
  const intake=projectIntake(safeMessages);
  if(intake){if('reply' in intake)return Response.json({reply:intake.reply,active:true});const quote=calcolaPreventivo(intake.input);if(!quote.errore)return Response.json({reply:formatQuote(intake.input,quote,messages.at(-1)!.content)+('\n\n'+(intake.input.progetto!.brani.some(b=>b.produzione==='genks')?'Per le produzioni ancora da creare uso la fascia fino a 8 tracce per brano; una fascia superiore cambia il prezzo.':'Il preventivo assume fino a 8 tracce audio separate per brano; puoi aggiornare la fascia nel modulo.')+(intake.input.progetto!.registrazione?` Registrazione: ${2*intake.input.progetto!.brani.length} ore incluse nel progetto, 2 per brano. Giorno e orario si scelgono nel modulo; nessuna sessione è stata ancora prenotata.`:' Non ho aggiunto ore di registrazione.')),active:true});}
  const reply=await rispondi(safeMessages);
  return Response.json({reply:reply||fallback,active:Boolean(reply)});
 }catch{return Response.json({reply:'Non riesco a elaborare questa richiesta. Riprova con un messaggio breve sui servizi GENKS.'},{status:400});}
}

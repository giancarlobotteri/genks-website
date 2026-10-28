import {recordingHoursOnly} from '@/lib/chatbot/booking-request';
import {audioIntake,reviewQuote,confirmedQuote,isQuoteConfirmation,reviseQuote} from '@/lib/chatbot/review';
import {quoteInputSchema} from '@/lib/chatbot/checkout';
import {projectIntake} from '@/lib/chatbot/project-intake';
import {answerBookingRequest} from '@/lib/chatbot/booking';
import {knownAnswer} from '@/lib/chatbot/answers';
import {z} from 'zod';
import {rispondi} from '@/lib/chatbot/providers';
import {allowPublicRequest} from '@/lib/security/request-limit';
export const runtime='nodejs';
export const maxDuration=60;
const fallback='L’assistente automatico non è attivo in questo momento. Puoi [scegliere un servizio](https://www.prodbygenks.com/services) o [scrivere a GENKS](https://www.instagram.com/prodbygenks/).';
const schema=z.object({messages:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().trim().min(1).max(1000)}).strict()).min(1).max(60),draft:quoteInputSchema.optional()}).strict();
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Richiesta non autorizzata.'},{status:403});
 if(!await allowPublicRequest('chat'))return Response.json({reply:'Hai inviato molte richieste. Riprova tra qualche minuto.'},{status:429});
 try{
  const text=await request.text();if(text.length>85000)return Response.json({error:'Messaggio troppo lungo.'},{status:413});
  const {messages,draft}=schema.parse(JSON.parse(text));if(messages[0].role!=='user'||messages.at(-1)?.role!=='user')throw Error('messages');
  if(/\b(?:il mio|mio)\s+(?:numero|telefono)\b/i.test(messages.at(-1)?.content??''))return Response.json({reply:'Non inserire dati personali in chat. Per parlare con GENKS usa [DM Instagram](https://www.instagram.com/prodbygenks/) o assistenza@prodbygenks.com.'});
  const privateText=(value:string)=>/[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?\d[\s().-]*){8,}|https?:\/\/|\b(?:il mio|mio)\s+(?:numero|telefono)\b/i.test(value);
  if(privateText(messages.at(-1)!.content))return Response.json({reply:'Non inserire email, telefoni, collegamenti ai file o dati personali in chat. Per il tuo ordine usa [l’assistenza](https://www.prodbygenks.com/account) oppure [DM Instagram](https://www.instagram.com/prodbygenks/).'});
  const safeMessages=messages.map(m=>m.role==='user'&&privateText(m.content)?{...m,content:'[Messaggio precedente con dati personali omesso]'}:m);
  const latest=messages.at(-1)!.content;
  if(draft&&/^(?:riepilogo|riprendiamo|ricordami il riepilogo|ricapitoliamo)[.!\s]*$/i.test(latest))return Response.json({...reviewQuote(draft),active:true});
  if(draft&&isQuoteConfirmation(latest))return Response.json({...confirmedQuote(draft,latest),active:true});
  if(draft){const revised=reviseQuote(draft,latest);if(revised)return Response.json({...reviewQuote(revised),active:true});}
  const audio=audioIntake(safeMessages);if(audio)return Response.json({...('input' in audio?reviewQuote(audio.input):audio),active:true});
  if(/quanto|costa|vorrei|voglio|mi serve/i.test(latest)&&/beat su misura/i.test(latest)&&!/mix|master|registr|\bep\b|album|diritt|revision/i.test(latest))return Response.json({...reviewQuote({beat_su_misura:1}),active:true});
  const known=knownAnswer(latest);if(known)return Response.json({reply:known,active:true});
  const booking=await answerBookingRequest(messages.at(-1)!.content);if(booking)return Response.json({reply:booking,active:true});
  const seeded=draft?.progetto&&!safeMessages.some(m=>m.role==='user'&&/\bep\b|\balbum\b/i.test(m.content))?[{role:'user' as const,content:`${draft.progetto.format??'ep'} da ${draft.progetto.brani.length} brani, produzioni GENKS. `+draft.progetto.brani.map((b,i)=>`brano ${i+1} con ${b.tracce} tracce`).join('; ')},...safeMessages]:safeMessages;
  const intake=projectIntake(seeded);
  if(intake){if('reply' in intake)return Response.json({reply:intake.reply,active:true});return Response.json({...reviewQuote(intake.input),active:true});}
  const hours=recordingHoursOnly(latest);if(hours)return Response.json({...reviewQuote({ore_registrazione:hours}),active:true});
  if(!process.env.CLOUDFLARE_ACCOUNT_ID||!process.env.CLOUDFLARE_API_TOKEN)return Response.json({reply:fallback,active:false});
  const context=draft?[{role:'user' as const,content:'Bozza corrente da mantenere salvo modifiche esplicite: '+JSON.stringify(draft).slice(0,16000)},...safeMessages]:safeMessages;
  const result=await rispondi(context);
  return Response.json(result?{...result,active:true}:{reply:fallback,active:false});
 }catch{return Response.json({reply:'Non riesco a elaborare questa richiesta. Riprova con un messaggio breve sui servizi GENKS.'},{status:400});}
}

import {hasRequestedDay} from './booking-request';
import {normalizeQuoteRequest,formatQuote,prepareQuoteArguments} from './quote-request';
import {quotePreventivo} from './checkout';
import {serviceAmount} from '../service-rates';
import {BOOKING_TOOL,availableBookingLinks} from './booking';
import {quoteInputSchema} from './checkout';
import {allowPublicRequest} from '@/lib/security/request-limit';
import { SYSTEM_PROMPT } from "./prompt";
import { calcolaPreventivo, codificaPreventivo, PREVENTIVO_TOOL } from "./pricing";

/**
 * FORNITORI DEL MODELLO AI
 * ------------------------
 * AI_PROVIDER = "cloudflare" (default) → Cloudflare Workers AI, piano gratuito
 *   (10.000 neuroni al giorno), utilizzabile per utenti in Italia/UE.
 *   Variabili: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CF_MODEL (facoltativa).
 *
 * AI_PROVIDER = "gemini" → Google Gemini. ATTENZIONE: per un chatbot pubblico rivolto
 *   a utenti nello Spazio Economico Europeo i termini Google richiedono i servizi
 *   A PAGAMENTO (fatturazione attiva). Variabili: GEMINI_API_KEY, GEMINI_MODEL.
 */

export type ChatMessage = { role: "user" | "assistant"; content: string };

const MAX_STEPS = 3; // il modello può chiamare la calcolatrice e poi rispondere

/** Esegue lo strumento richiesto dal modello. */
async function eseguiStrumento(name:string,args:unknown,requestText='',authorizationText=requestText):Promise<unknown>{
 try{if(name===PREVENTIVO_TOOL.name){const input=quoteInputSchema.parse(normalizeQuoteRequest(quoteInputSchema.parse(prepareQuoteArguments(args)),requestText,authorizationText)),result=calcolaPreventivo(input);if(result.errore)return result;const guarantees=quotePreventivo(codificaPreventivo(input)).parts.flatMap(p=>p.guarantees);return {...result,rendered_reply:/garanzia|rimborso|non.*(?:mi piace|convinc)/i.test(requestText)?`Hai una revisione inclusa per brano e lavorazione. Dopo la versione revisionata, se il risultato non ti convince, puoi richiedere il rimborso del 30% entro 14 giorni, una volta per brano. ${guarantees.length?`Esempio su questo servizio da ${result.totale}: ${serviceAmount(guarantees[0].amount)} di rimborso.`:''} Extra, registrazione e beat su misura sono esclusi dalla garanzia commerciale. [Leggi le condizioni](https://www.prodbygenks.com/legal/refunds)`:formatQuote(input,result,requestText),...guarantees.length?{garanzia_per_brano:guarantees.map(g=>({brano:g.title,rimborso:serviceAmount(g.amount)}))}:{}};}if(name===BOOKING_TOOL.name){if(!hasRequestedDay(authorizationText))return {errore:'Il cliente non ha indicato un giorno. Non inventare una data: per le ore richieste usa calcola_preventivo, oppure chiedi il giorno se vuole verificare disponibilità.'};const r=await availableBookingLinks(args);const day=new Date(r.data+'T12:00:00Z').toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long',timeZone:'Europe/Rome'});const slots=r.orari.filter(x=>x.inizio.endsWith(':00')||x.inizio.endsWith(':30')).slice(0,8);const answer=r.richiesto?`${r.richiesto.disponibile?'Sì':'No'}, ${day} alle ${r.richiesto.inizio} ${r.richiesto.disponibile?'risulta disponibile':'non risulta disponibile'} per ${r.ore} ${r.ore===1?'ora':'ore'}.`:`${day}, per ${r.ore} ore: ${r.orari.length?'questi orari risultano liberi':'non risultano intervalli disponibili'}.`;return {...r,rendered_reply:[answer,(!r.richiesto||!r.richiesto.disponibile?slots.map(x=>`[${x.inizio} · scegli questo orario](${x.link})`):r.orari.filter(x=>x.inizio===r.richiesto!.inizio).map(x=>`[Scegli e conferma la sessione](${x.link})`)).join('\n'),r.ore===1?'Ho verificato un’ora: se vuoi registrare di più dimmi la durata.':'La disponibilità è verificata per tutta la durata indicata.','Nessuna prenotazione è stata creata; la sessione si conferma dopo il pagamento dell’anticipo.'].join('\n\n')};}return {errore:'Strumento sconosciuto'};}catch(error){return {errore:error instanceof Error?error.message:'Richiesta non valida o calendario non verificabile. Non inventare disponibilità o prezzi.'};}
}

/** Converte lo schema dello strumento (formato Gemini, tipi MAIUSCOLI) in JSON Schema standard. */
function toJsonSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toJsonSchema);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = k === "type" && typeof v === "string" ? v.toLowerCase() : toJsonSchema(v);
    }
    return out;
  }
  return node;
}

/** Toglie eventuali ragionamenti interni (<think>...</think>) dalla risposta. */
const pulisci = (s: string) => s.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "").trim().slice(0,6000);

// ---------------------------------------------------------------------------
// CLOUDFLARE WORKERS AI (endpoint compatibile OpenAI)
// ---------------------------------------------------------------------------

type OAIToolCall = { id: string; type: "function"; function: { name: string; arguments: string | object } };
type OAIMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string; tool_calls?: OAIToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export async function rispondiConCloudflare(messages: ChatMessage[]): Promise<string | null> {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!account || !/^[a-f0-9]{32}$/i.test(account) || !token) {
    console.error("[chat] CLOUDFLARE_ACCOUNT_ID o CLOUDFLARE_API_TOKEN mancanti");
    return null;
  }
  const model = process.env.CF_MODEL || "@cf/qwen/qwen3-30b-a3b-fp8";
  if(model!=="@cf/qwen/qwen3-30b-a3b-fp8")return null;
  const url = `https://api.cloudflare.com/client/v4/accounts/${account}/ai/v1/chat/completions`;

  const conv: OAIMessage[] = [
    // "/no_think" disattiva il ragionamento esteso di Qwen3: risposte più rapide e meno neuroni consumati.
    { role: "system", content: `${SYSTEM_PROMPT}
REGOLE OPERATIVE DI COLLAUDO:
- EP/album includono obbligatoriamente produzioni GENKS, mix/master e 2 ore per brano. Chiedi solo le informazioni mancanti. Mantieni formato, brani, quantità di tracce per ciascun brano e ore incluse. Con basi esterne usa servizi singoli, senza addebitare beat GENKS. Solo EP e album non consentono ore aggiuntive nel preventivo: per altre ore serve una nuova prenotazione separata su /services/recording con relativo pagamento, secondo disponibilità. Negli altri pacchetti le ore aggiuntive consentite restano configurabili.
- Beat + registrazione + mix di un pezzo: valuta il Singolo chiavi in mano, con beat GENKS, 2 ore e mix + master. Non inventare un nuovo pacchetto.
- DISPONIBILITÀ: analizza direttamente la richiesta con orari_disponibili. Rispondi sì o no in base al calendario. Se manca la durata per una domanda su un orario preciso, verifica un’ora e specificalo; poi chiedi la durata desiderata. Non rimandare alla pagina per controllare. Se il cliente indica un orario, passa anche ora allo strumento. Rispondi solo con gli esiti verificati, proponi alternative se occupato. Non creare riserve e non dire che l’appuntamento è confermato: il cliente deve comunque scegliere e pagare da solo.
- Usa data e ora italiane qui indicate per interpretare sabato, domani e altri giorni relativi. Per una richiesta con ora finale notturna determina l’inizio dalla durata, verifica il giorno con lo strumento e chiedi alla calcolatrice il supplemento delle mezzore dopo mezzanotte.
- Per la garanzia usa solo garanzia_per_brano restituita dal server: una revisione inclusa, domanda entro 14 giorni dalla sua consegna, 30% della quota scontata, extra esclusi. Non calcolare percentuali a mente.
- Proponi soltanto le combinazioni verificate restituite dalla calcolatrice: valuta Master Pack, Blocco 5 ore e studio+mix/master/chiavi in mano se pertinenti e più convenienti. Non promettere sconti quantità non presenti, né il vecchio vantaggio del quarto brano. Riporta totale, risparmio reale in euro, importo iniziale e saldo.
Data e ora italiane: ${new Date().toLocaleString("it-IT",{timeZone:"Europe/Rome"})}\n\n/no_think` },
    ...messages.map((m) => ({ role: m.role, content: m.content }) as OAIMessage),
  ];
  const tools=[PREVENTIVO_TOOL,BOOKING_TOOL].map(tool=>({type:'function',function:{name:tool.name,description:tool.description,parameters:toJsonSchema(tool.parameters)}}));
  const deadline=AbortSignal.timeout(50000);
  let toolFailed=false;

  for (let step = 0; step < MAX_STEPS; step++) {
    if(!await allowPublicRequest('chat-provider'))return null;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ model, messages: conv, tools, temperature: 0.3, max_tokens: messages.some(m=>m.role==='user'&&/\bEP\b|album|produzioni/i.test(m.content))?4096:900 }),
      signal: deadline,
    });
    if (!res.ok) {
      const diagnostic=await res.json().catch(()=>({}));
      const codes=Array.isArray(diagnostic.errors)?diagnostic.errors.map((e:{code?:unknown})=>e.code).filter((c:unknown)=>typeof c==='number'):[];
      const errorText=JSON.stringify(diagnostic).toLowerCase();
      const hints=['tools','tool_calls','content','schema','model','token','permission','messages','context','max_tokens','temperature','authentication','validation'].filter(h=>errorText.includes(h));
      console.error("[chat] Cloudflare status",res.status,JSON.stringify({step,codes,hints}));
      return null;
    }
    const data = await res.json();
    const msg = data?.choices?.[0]?.message;
    const calls: OAIToolCall[] = msg?.tool_calls ?? [];
    if(!Array.isArray(calls)||calls.length>4)return null;

    if (!calls.length) {
      if(toolFailed){conv.push({role:'user',content:'Il calcolo precedente non è riuscito. Non promettere ricalcoli futuri: usa adesso calcola_preventivo con i campi corretti, oppure chiedi una sola informazione effettivamente mancante.'});continue;}
      const testo = typeof msg?.content === "string" ? pulisci(msg.content) : "";
      if(/[€$]|\b(?:euro|eur)\b|\d+[.,]\d{2}/i.test(testo)){
        conv.push({role:'assistant',content:testo});conv.push({role:'user',content:'Per indicare importi devi prima chiamare calcola_preventivo con i dettagli della mia richiesta iniziale. Non calcolare né riscrivere cifre a mente.'});continue;
      }
      return testo || null;
    }

    conv.push({ role: "assistant", content: typeof msg?.content === "string" ? msg.content : "", tool_calls: calls });
    const rendered:string[]=[];
    for (const call of calls) {
      if(!call.id||call.id.length>200||!call.function)return null;
      let args: unknown = call.function?.arguments;
      if (typeof args === "string") {
        try {
          args = JSON.parse(args || "{}");
        } catch {
          args = {};
        }
      }
      const result=await eseguiStrumento(call.function?.name,args,messages.filter(m=>m.role==='user').at(-1)?.content??'',messages.filter(m=>m.role==='user').map(m=>m.content).join('\n'));
      if(result&&typeof result==='object'&&'errore' in result)toolFailed=true;
      if(result&&typeof result==='object'&&'rendered_reply' in result&&typeof result.rendered_reply==='string')rendered.push(result.rendered_reply);
      conv.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
    if(rendered.length)return rendered.join("\n\n");
  }
  return toolFailed?'Non ho ancora un totale verificato per questa combinazione. Puoi completare le scelte dal [listino servizi](https://www.prodbygenks.com/services): il prezzo si aggiorna sulle quantità selezionate. Nessun ordine è stato creato.':null;
}

// ---------------------------------------------------------------------------
// GOOGLE GEMINI (solo con fatturazione attiva per utenti UE)
// ---------------------------------------------------------------------------

type GeminiPart = {
  text?: string;
  functionCall?: { name: string; args?: unknown };
  functionResponse?: { name: string; response: unknown };
  [key: string]: unknown; // es. thoughtSignature: va rimandato intatto
};
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

export async function rispondiConGemini(messages: ChatMessage[]): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[chat] GEMINI_API_KEY mancante");
    return null;
  }
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const contents: GeminiContent[] = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        tools: [{ functionDeclarations: [PREVENTIVO_TOOL,BOOKING_TOOL] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 900 },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      console.error("[chat] Gemini status", res.status);
      return null;
    }
    const data = await res.json();
    const parts: GeminiPart[] = data?.candidates?.[0]?.content?.parts ?? [];
    const calls = parts.filter((p) => p.functionCall);

    if (!calls.length) {
      const testo = pulisci(parts.map((p) => p.text ?? "").join(""));
      return testo || null;
    }

    contents.push({ role: "model", parts });
    contents.push({
      role: "user",
      parts: await Promise.all(calls.map(async (p) => ({
        functionResponse: {
          name: p.functionCall!.name,
          response: { result: await eseguiStrumento(p.functionCall!.name, p.functionCall!.args) },
        },
      }))),
    });
  }
  return null;
}

/** Public GENKS dispatch is Cloudflare-only. Never fall back to a paid provider. */
export function rispondi(messages:ChatMessage[]):Promise<string|null>{
 if((process.env.AI_PROVIDER||'cloudflare').toLowerCase()!=='cloudflare')return Promise.resolve(null);
 return rispondiConCloudflare(messages);
}

import {BOOKING_TOOL,availableBookingLinks} from './booking';
import {quoteInputSchema} from './checkout';
import {allowPublicRequest} from '@/lib/security/request-limit';
import { SYSTEM_PROMPT } from "./prompt";
import { calcolaPreventivo, PREVENTIVO_TOOL } from "./pricing";

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
async function eseguiStrumento(name:string,args:unknown):Promise<unknown>{
 try{if(name===PREVENTIVO_TOOL.name)return calcolaPreventivo(quoteInputSchema.parse(args));if(name===BOOKING_TOOL.name)return await availableBookingLinks(args);return {errore:'Strumento sconosciuto'};}catch{return {errore:'Richiesta non valida o calendario non verificabile. Non inventare disponibilità o prezzi: rimanda alla pagina Servizi.'};}
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
    { role: "system", content: `${SYSTEM_PROMPT}\nData e ora italiane: ${new Date().toLocaleString("it-IT",{timeZone:"Europe/Rome"})}\n\n/no_think` },
    ...messages.map((m) => ({ role: m.role, content: m.content }) as OAIMessage),
  ];
  const tools=[PREVENTIVO_TOOL,BOOKING_TOOL].map(tool=>({type:'function',function:{name:tool.name,description:tool.description,parameters:toJsonSchema(tool.parameters)}}));
  const deadline=AbortSignal.timeout(50000);

  for (let step = 0; step < MAX_STEPS; step++) {
    if(!await allowPublicRequest('chat-provider'))return null;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ model, messages: conv, tools, temperature: 0.3, max_tokens: 900 }),
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
      const testo = typeof msg?.content === "string" ? pulisci(msg.content) : "";
      return testo || null;
    }

    conv.push({ role: "assistant", content: typeof msg?.content === "string" ? msg.content : "", tool_calls: calls });
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
      conv.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(await eseguiStrumento(call.function?.name, args)),
      });
    }
  }
  return null;
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

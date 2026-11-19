// Requests from the virtual studio (studio sessions, custom beats, mix/master, beat licences, packages):
// one confirmation to the customer and one notice to GENKS, sent the way the previous site sends them.
// Every message is first recorded in the Supabase notification queue (public.notification_outbox,
// shared with prodbygenks.com) and then sent at once with Resend; whatever Resend cannot send now stays
// queued, and the scheduled worker of the main site delivers it later.
//
// Environment (Vercel, server only): RESEND_API_KEY, RESEND_FROM_EMAIL, GENKS_ADMIN_EMAIL,
// GENKS_SUPPORT_EMAIL, and for the queue NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) + SUPABASE_SECRET_KEY.

const KINDS = {
  booking: { label: "Registrazione in studio", customer: "Abbiamo ricevuto la tua richiesta di sessione." },
  "remote-project": { label: "Mix / Master", customer: "Abbiamo ricevuto la tua richiesta di mix e master." },
  "custom-beat": { label: "Beat su misura", customer: "Abbiamo ricevuto il tuo brief." },
  bundle: { label: "Pacchetto", customer: "Abbiamo ricevuto la tua richiesta di pacchetto." },
  exclusive: { label: "Licenza esclusiva", customer: "Abbiamo ricevuto la tua richiesta di esclusiva." },
  order: { label: "Licenze beat", customer: "Abbiamo ricevuto la tua richiesta di licenza." },
} as const;
type Kind = keyof typeof KINDS;

const NEXT_STEP: Record<Kind, string> = {
  booking: "Ti confermiamo giorno e orario per email. La sessione è confermata dopo il pagamento dell’anticipo o in contanti in studio.",
  "remote-project": "Ti rispondiamo con il riepilogo, il link per caricare le tracce e il pagamento. La lavorazione parte dopo il pagamento e la ricezione dei file.",
  "custom-beat": "Ti rispondiamo con le domande sul brief e il link per il pagamento. La prima versione arriva entro 10 giorni lavorativi dall’avvio.",
  bundle: "Ti rispondiamo con il riepilogo del pacchetto, le date e il pagamento.",
  exclusive: "Valutiamo la richiesta e ti rispondiamo con la proposta per l’esclusiva.",
  order: "Ti inviamo il contratto di licenza e il link per il pagamento; i file arrivano dopo il pagamento.",
};

// keep printable text only (no control characters), trimmed and bounded
const printable = (v: string) => Array.from(v).filter(c => c === "\n" || c === "\t" || c.charCodeAt(0) >= 32).join("");
const clean = (v: unknown, max = 600) => (typeof v === "string" ? printable(v).trim().slice(0, max) : "");
const emailOk = (v: string) => /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[a-z]{2,}$/i.test(v) && v.length <= 254;

const FIELD_LABELS: Record<string, string> = {
  name: "Nome", email: "Email", phone: "Telefono", artist: "Nome d’arte", date: "Giorno", slot: "Orario", hours: "Ore",
  package: "Pacchetto", service: "Servizio", tracks: "Tracce", genre: "Genere", bpm: "BPM", mood: "Mood", reference: "Riferimento",
  referenceUrl: "Riferimento", description: "Descrizione", notes: "Note", offer: "Offerta indicativa", deadline: "Scadenza",
  files: "File indicati", total: "Totale indicativo", beat: "Beat", licenses: "Licenze",
  time: "Ora di inizio", duration: "Durata", appointment: "Appuntamento",
};

/* ---- Studio calendar: the slot is checked again on the backend when the request is sent ---- */
const BACKEND = (process.env.GENKS_BACKEND_ORIGIN || "https://app.prodbygenks.com").replace(/\/$/, "");
/** Minimum notice before a start (the backend's card rule: 65 minutes). */
const NOTICE_MINUTES = 65;
const romeOffset = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", timeZoneName: "longOffset" });
const romeWall = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** Same resolution as the backend's fromRomeWallTime: NaN for a missing wall time, later instant for a repeated one. */
function romeInstant(day: string, time: string) {
  const naive = Date.parse(`${day}T${time}:00Z`), found: number[] = [];
  if (!Number.isFinite(naive)) return NaN;
  for (const h of [-24, 0, 24]) {
    const m = /GMT([+-])(\d{2}):(\d{2})/.exec(romeOffset.formatToParts(new Date(naive + h * 3600000)).find(x => x.type === "timeZoneName")?.value ?? "");
    if (!m) continue;
    const at = naive - (Number(m[2]) * 60 + Number(m[3])) * (m[1] === "+" ? 1 : -1) * 60000;
    const p = Object.fromEntries(romeWall.formatToParts(new Date(at)).map(x => [x.type, x.value]));
    if (`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}` === `${day}T${time}`) found.push(at);
  }
  return found.length ? Math.max(...found) : NaN;
}

type SlotCheck = { ok: true } | { ok: false; status: number; error: string };
/** Read-only check on the existing backend that `time` on `date` is still free for `hours`. */
async function checkStudioSlot(date: string, time: string, hours: number): Promise<SlotCheck> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !(hours >= 1 && hours <= 8 && Number.isInteger(hours * 2)))
    return { ok: false, status: 400, error: "Scegli giorno, ora e durata della sessione." };
  const start = romeInstant(date, time);
  if (!Number.isFinite(start) || start <= Date.now() + NOTICE_MINUTES * 60000)
    return { ok: false, status: 409, error: "L’orario scelto è troppo vicino o non è più valido. Scegline un altro." };
  try {
    const r = await fetch(`${BACKEND}/api/availability?${new URLSearchParams({ date, duration: String(hours) })}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(9000) });
    const body = (await r.json().catch(() => null)) as { slots?: unknown } | null;
    if (!r.ok || !body || !Array.isArray(body.slots)) throw new Error(`availability ${r.status}`);
    return body.slots.includes(time) ? { ok: true } : { ok: false, status: 409, error: "L’orario scelto non è più libero per questa durata. Torna al calendario e scegline un altro." };
  } catch {
    return { ok: false, status: 503, error: "Non riesco a verificare il calendario dello studio in questo momento. Riprova tra poco." };
  }
}

function reference() {
  const d = new Date(), p = (n: number) => String(n).padStart(2, "0");
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(3)), b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `VS-${String(d.getUTCFullYear()).slice(2)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${rand}`;
}

type Message = { key: string; to: string; subject: string; heading: string; body: string; actionUrl?: string; actionLabel?: string; replyTo?: string };

const supabase = () => {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_GENKS_SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return url && key ? { url, key } : null;
};

async function queue(m: Message) {
  const db = supabase();
  if (!db) return null;
  const r = await fetch(`${db.url}/rest/v1/notification_outbox?on_conflict=dedupe_key`, {
    method: "POST",
    headers: { apikey: db.key, Authorization: `Bearer ${db.key}`, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({ dedupe_key: m.key, recipient: m.to, subject: m.subject, heading: m.heading, body: m.body, action_url: m.actionUrl ?? null, action_label: m.actionLabel ?? null }),
  });
  if (!r.ok) throw new Error(`queue ${r.status}`);
  const rows = (await r.json()) as { id: string }[];
  return rows[0]?.id ?? null;
}

async function markSent(id: string) {
  const db = supabase();
  if (!db) return;
  await fetch(`${db.url}/rest/v1/notification_outbox?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { apikey: db.key, Authorization: `Bearer ${db.key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ sent_at: new Date().toISOString(), last_error: null, locked_until: null }),
  }).catch(() => {});
}

async function send(m: Message) {
  const key = process.env.RESEND_API_KEY, from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) return false;
  const text = `${m.heading}\n\n${m.body}${m.actionUrl ? `\n\n${m.actionLabel ?? "Apri"}: ${m.actionUrl}` : ""}\n\nGENKS · prodbygenks.com\nPer assistenza rispondi a questa email.`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": m.key },
    body: JSON.stringify({
      from, to: m.to, subject: m.subject, text,
      reply_to: m.replyTo || process.env.GENKS_SUPPORT_EMAIL || process.env.GENKS_ADMIN_EMAIL || undefined,
      html: renderGenksStudioEmail({ subject: m.subject, heading: m.heading, body: m.body, actionUrl: m.actionUrl, actionLabel: m.actionLabel }),
    }),
  });
  return r.ok;
}

/** Record in the queue, then send now; a message that cannot be sent now stays queued for the worker. */
async function deliver(m: Message) {
  const id = await queue(m).catch(() => null);
  const sent = await send(m).catch(() => false);
  if (sent && id) await markSent(id);
  return { queued: Boolean(id), sent };
}

export async function POST(request: Request) {
  let input: Record<string, unknown>;
  try { input = (await request.json()) as Record<string, unknown>; } catch { return Response.json({ error: "Richiesta non valida." }, { status: 400 }); }
  // a field only robots fill in
  if (clean(input.website)) return Response.json({ ok: true, reference: reference() });
  const kind = clean(input.kind, 40) as Kind;
  if (!(kind in KINDS)) return Response.json({ error: "Tipo di richiesta non valido." }, { status: 400 });
  const data = (input.data && typeof input.data === "object" ? input.data : {}) as Record<string, unknown>;
  const name = clean(data.name, 120), email = clean(data.email, 254).toLowerCase();
  if (!name || !emailOk(email)) return Response.json({ error: "Nome ed email validi sono obbligatori." }, { status: 400 });
  if (kind === "booking") {
    const check = await checkStudioSlot(clean(data.date, 10), clean(data.time, 5), Number(clean(data.hours, 4)));
    if (!check.ok) return Response.json({ error: check.error }, { status: check.status });
  }
  const summary = clean(input.summary, 400);
  const ref = reference();
  const rows = Object.entries(data)
    .filter(([k, v]) => !["name", "email", "ack", "consent", "website"].includes(k) && clean(v))
    .slice(0, 30)
    .map(([k, v]) => `${FIELD_LABELS[k] ?? k}: ${clean(v, 1200)}`);
  const what = KINDS[kind];

  const customer: Message = {
    key: `vs-${ref}-customer`, to: email,
    subject: `GENKS · ${what.label} · ${ref}`,
    heading: what.customer,
    body: [`Ciao ${name}, grazie per aver scelto GENKS.`, `Riferimento: ${ref}`, `Servizio: ${what.label}`, ...(summary ? [`Riepilogo: ${summary}`] : []), ...rows, NEXT_STEP[kind], "Per qualsiasi domanda rispondi direttamente a questa email."].join("\n"),
  };
  const owner = process.env.GENKS_ADMIN_EMAIL;
  const admin: Message | null = owner ? {
    key: `vs-${ref}-admin`, to: owner, replyTo: email,
    subject: `GENKS · Nuova richiesta · ${what.label} · ${ref}`,
    heading: "Hai una nuova richiesta dal sito.",
    body: [`Riferimento: ${ref}`, `Servizio: ${what.label}`, `Cliente: ${name}`, `Email cliente: ${email}`, ...(summary ? [`Riepilogo: ${summary}`] : []), ...rows, "Rispondi a questa email per scrivere direttamente al cliente."].join("\n"),
  } : null;

  const results = await Promise.all([deliver(customer), admin ? deliver(admin) : Promise.resolve({ queued: false, sent: false })]);
  const handled = results[0].sent || results[0].queued;
  if (!handled) return Response.json({ error: "Il servizio email non è disponibile in questo momento. Scrivici a assistenza@prodbygenks.com." }, { status: 503 });
  return Response.json({ ok: true, reference: ref, emailed: results[0].sent });
}

/* ---------- the GENKS email design (from the previous site, src/lib/email-design.ts) ---------- */
// The GENKS email design, the same one the previous site (prodbygenks.com) sends with Resend.
type SavedOrderPart = { title: string; hours?: string; items: { name: string; amount?: string }[] };

type StudioEmail = {subject:string;heading:string;body:string;actionUrl?:string;actionLabel?:string;totalLabel?:string;compact?:boolean;receiptFooter?:boolean;purchaseDetails?:SavedOrderPart[]};
const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]!);

/** Table layout and inline colours keep the essential design readable in mail clients. */
function renderGenksStudioEmail(input:StudioEmail) {
  const lines=input.body.replace(/(?:\.\s+| · )(?=(?:Totale|Appuntamento|Riferimento|Email cliente|Telefono|Indirizzo|Sessione in studio|Scadenza concordata):)/g,"\n").split(/\n+/).map(line=>line.trim()).filter(Boolean);
  const paragraphs=lines.map(line=>{
    if(line.startsWith("Totale: "))return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0"><tr><td bgcolor="#10274b" style="padding:20px 22px;border:1px solid #2b5590;border-radius:14px"><span style="display:block;color:#a5dcff;font-size:10px;font-weight:700;letter-spacing:2px">${escape(input.totalLabel??"TOTALE")}</span><strong style="display:block;margin-top:9px;color:#ffffff;font-size:32px;letter-spacing:-.5px">${escape(line.slice(8))}</strong></td></tr></table>`;
    const field=line.match(/^([^:\n]{2,48}):\s+([\s\S]+)$/);
    if(field&&!/^https?$/i.test(field[1]))return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 14px"><tr><td bgcolor="#10274b" style="padding:17px 20px;border:1px solid #2b5590;border-radius:12px"><span style="display:block;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase">${escape(field[1])}</span><p style="margin:8px 0 0;color:#ffffff;font-size:16px;line-height:1.65;overflow-wrap:anywhere">${escape(field[2])}</p></td></tr></table>`;
    return `<p style="margin:0 0 24px;padding-bottom:16px;border-bottom:1px solid #234774;color:#ffffff;font-size:16px;line-height:1.8;overflow-wrap:anywhere">${escape(line)}</p>`;
  }).join("");
  const purchaseDetails = input.purchaseDetails?.length ? `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 14px">
      <tr><td bgcolor="#10274b" style="padding:17px 20px;border:1px solid #2b5590;border-radius:12px">
        <span style="display:block;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Acquistato / prenotato</span>
        ${input.purchaseDetails.map(part => `
          <p style="margin:14px 0 4px;color:#ffffff;font-size:16px"><strong>${escape(part.title)}</strong></p>
          ${part.hours ? `<p style="margin:0 0 8px;color:#ffffff;font-size:14px">Studio · ${escape(part.hours)}</p>` : ''}
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            ${part.items.map(item => `<tr><td style="padding:7px 8px 7px 0;border-top:1px solid #315b92;font-size:14px;color:#ffffff;overflow-wrap:anywhere">${escape(item.name)}</td><td align="right" style="padding:7px 0;border-top:1px solid #315b92;font-size:14px;color:#ffffff;white-space:nowrap">${escape(item.amount ?? '')}</td></tr>`).join('')}
          </table>`).join('')}
      </td></tr>
    </table>` : '';
  return renderGenksEmailFrame(input, paragraphs + purchaseDetails);
}

function renderGenksEmailFrame(input:StudioEmail,paragraphs:string) {
  const reference=input.subject.match(/\b(?:BKG|PRJ|GK|VS)-[A-Z0-9-]+\b/)?.[0];
  let actionUrl:string|undefined;
  try{const url=new URL(input.actionUrl??"");if(url.protocol==="https:")actionUrl=url.href}catch{/* not a link */}
  return protectMailColours(`<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${escape(input.subject)}</title><style>u + .genks-email .gmail-blend-screen{background:#000;mix-blend-mode:screen}u + .genks-email .gmail-blend-difference{background:#000;mix-blend-mode:difference}@media only screen and (max-width:600px){.outer{padding:20px 10px!important}.content{padding:28px 24px!important}.hero-title{font-size:32px!important}.brand{font-size:31px!important}.cta{display:block!important;padding:17px 16px!important}}</style></head>
  <body class="genks-email" style="margin:0;padding:0;background:#030917;color:#ffffff;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escape(input.heading)}${reference?` · ${reference}`:""}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#030917"><tr><td align="center" class="outer" style="padding:44px 16px;background:radial-gradient(ellipse at top,#102b5a,#030917 65%)">
  <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px">
  <tr><td style="padding:0 8px 22px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td class="brand" style="font-size:35px;font-weight:800;letter-spacing:5px;color:#ffffff;line-height:1">GENKS<span style="color:#4f9dff">.</span></td><td align="right" style="font-size:10px;font-weight:700;letter-spacing:3px;color:#a8dcff">STUDIO<br><span style="display:inline-block;padding-top:7px;color:#76bfff">ONLINE</span></td></tr></table></td></tr>
  <tr><td style="height:3px;background:#3585ff;background:linear-gradient(90deg,#12396f,#53b5ff,#2558dd);border-radius:20px 20px 0 0;font-size:0;line-height:3px">&nbsp;</td></tr>
  <tr><td bgcolor="#0a1830" class="content" style="padding:40px 40px 32px;border:1px solid #203f6c;border-top:0;border-bottom:0;background:linear-gradient(135deg,#102b50 0%,#0a1830 70%)">
  <table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="padding:7px 11px;border:1px solid #315b92;border-radius:30px;color:#91c7ff;font-size:10px;font-weight:700;letter-spacing:1.6px">${reference?escape(reference):"GENKS · STUDIO"}</td></tr></table>
  <h1 class="hero-title" style="margin:25px 0 20px;font-size:38px;line-height:1.17;letter-spacing:-1px;font-weight:800;color:#ffffff">${escape(input.heading)}</h1>
  <table role="presentation" width="88" cellspacing="0" cellpadding="0"><tr><td width="47" height="4" bgcolor="#53a8ff" style="border-radius:4px;font-size:0">&nbsp;</td><td width="7"></td><td width="22" bgcolor="#286de0" style="border-radius:4px;font-size:0">&nbsp;</td><td width="7"></td><td width="5" bgcolor="#174980" style="border-radius:4px;font-size:0">&nbsp;</td></tr></table>
  </td></tr>
  <tr><td bgcolor="#081326" class="content" style="padding:32px 40px 36px;border-left:1px solid #203f6c;border-right:1px solid #203f6c">
  ${paragraphs}
  ${actionUrl?`<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:27px"><tr><td style="padding-top:22px;border-top:1px solid #1e3558"><p style="margin:0 0 15px;font-size:10px;letter-spacing:2px;font-weight:700;color:#a8dcff">IL PROSSIMO PASSAGGIO</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" bgcolor="#2565e8" style="border:1px solid #5298ff;border-radius:14px;background:linear-gradient(105deg,#2155cd,#2d84f4)"><a class="cta" href="${escape(actionUrl)}" style="display:block;padding:18px 22px;font-size:15px;line-height:1.5;font-weight:700;color:#ffffff;text-decoration:none;border-radius:14px">${escape(input.actionLabel??"Apri il tuo spazio GENKS")} &nbsp;→</a></td></tr></table></td></tr></table>`:""}
  </td></tr>
  ${input.compact?(input.receiptFooter?`<tr><td bgcolor="#0b1b34" class="content" style="padding:26px 40px;border:1px solid #203f6c;border-radius:0 0 20px 20px;color:#ffffff"><p style="margin:0 0 18px;color:#ffffff;font-size:15px;line-height:1.8">Presenta questo codice in studio per i pagamenti in contanti. La sessione si conferma dopo l’incasso dell’importo richiesto.</p><p style="margin:0 0 14px;color:#ffffff;font-size:15px">Studio: Via Quintina, Ponte San Giovanni, 06135 Perugia (PG), Italia</p><a href="mailto:assistenza@prodbygenks.com" style="color:#ffffff;font-size:15px">assistenza@prodbygenks.com</a></td></tr>`:''): `  <tr><td bgcolor="#0b1b34" class="content" style="padding:24px 40px;border:1px solid #203f6c;border-radius:0 0 20px 20px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="border-left:3px solid #428fff;padding-left:15px"><strong style="font-size:13px;color:#b7d8ff">Ci siamo, anche dopo questa email.</strong><p style="margin:6px 0 0;font-size:13px;line-height:1.7;color:#b7e4ff">Per un chiarimento puoi rispondere a questo messaggio.${reference?` Conserva il riferimento <strong style="color:#c9e2ff">${escape(reference)}</strong>.`:""}</p></td></tr></table></td></tr>
  <tr><td align="center" style="padding:24px 14px 0;font-size:11px;line-height:1.9;color:#9ed5ff"><strong style="color:#c2e8ff;letter-spacing:2px">GENKS</strong><br>Comunicazione relativa alla tua richiesta.<br><a href="https://www.prodbygenks.com" style="color:#83b9ff;text-decoration:none">prodbygenks.com</a></td></tr>
`}
  </table></td></tr></table></body></html>`);
}

/** Gmail iOS inverts white text, but leaves gradient backgrounds intact. Lock
 * backgrounds, then restore white glyphs with screen/difference blending only
 * in Gmail (its injected `u` identifies the client). Other clients use inline
 * white text normally. This operates only on the controlled frame above. */
function protectMailColours(html:string) {
  const locked=html.replace(/style="([^"]*)"/g,(_attribute,style:string)=>{
    let next=style.replace(/(^|;)color:#[a-f\d]{3,6}(?=;|$)/gi,"$1color:#ffffff");
    if(!/background:(?:linear|radial)-gradient|background-image:/i.test(next)){
      const background=next.match(/(?:^|;)background:(#[a-f\d]{3,6})(?:;|$)/i)?.[1];
      if(background)next+=`;background-image:linear-gradient(${background},${background})`;
    }
    return `style="${next}"`;
  }).replace(/bgcolor="(#[a-f\d]{3,6})"([^>]*?)style="([^"]*)"/gi,(attribute,colour:string,between:string,style:string)=>
    /background(?:-image)?:/i.test(style)?attribute:`bgcolor="${colour}"${between}style="${style};background:${colour};background-image:linear-gradient(${colour},${colour})"`);
  const start=locked.indexOf("<body");
  return locked.slice(0,start)+locked.slice(start).split(/(<[^>]+>)/g).map(part=>{
    if(part.startsWith("<")||!part.replace(/&nbsp;|\s/g,""))return part;
    return `<span class="gmail-blend-screen"><span class="gmail-blend-difference" style="color:#ffffff">${part}</span></span>`;
  }).join("");
}


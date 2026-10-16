type StudioEmail = {subject:string;heading:string;body:string;actionUrl?:string;actionLabel?:string;totalLabel?:string};
const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]!);

/** Table layout and inline colours keep the essential design readable in mail clients. */
export function renderGenksStudioEmail(input:StudioEmail) {
  const paragraphs=input.body.split(/\n+/).filter(Boolean).map(line=>{
    if(line.startsWith("Totale: "))return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0"><tr><td bgcolor="#10274b" style="padding:20px 22px;border:1px solid #2b5590;border-radius:14px"><span style="display:block;color:#a5dcff;font-size:10px;font-weight:700;letter-spacing:2px">${escape(input.totalLabel??"IL TUO PREVENTIVO")}</span><strong style="display:block;margin-top:9px;color:#ffffff;font-size:32px;letter-spacing:-.5px">${escape(line.slice(8))}</strong></td></tr></table>`;
    return `<p style="margin:0 0 16px;color:#ffffff;font-size:16px;line-height:1.8;overflow-wrap:anywhere">${escape(line)}</p>`;
  }).join("");
  return renderGenksEmailFrame(input,paragraphs);
}

/** Only accepts reviewed Supabase template source, never customer-supplied HTML. */
export function renderGenksAuthEmail(template:string) {
  const heading=template.match(/<h2>([\s\S]*?)<\/h2>/i)?.[1]??"Il tuo account GENKS";
  const content=template.replace(/<h2>[\s\S]*?<\/h2>/i,"")
    .replaceAll('<p>{{ .Token }}</p>','<p style="padding:20px;border:1px solid #428fff;border-radius:14px;background:#10274b;color:#ffffff;font-size:32px;font-weight:700;letter-spacing:8px;text-align:center">{{ .Token }}</p>')
    .replaceAll('<p>','<p style="margin:0 0 18px;color:#ffffff;font-size:16px;line-height:1.8">')
    .replaceAll('<a ','<a style="display:inline-block;padding:16px 22px;border:1px solid #5298ff;border-radius:14px;background:#2565e8;color:#ffffff;text-decoration:none;font-weight:700" ');
  return renderGenksEmailFrame({subject:"GENKS · Account",heading,body:""},content);
}

function renderGenksEmailFrame(input:StudioEmail,paragraphs:string) {
  const reference=input.subject.match(/\b(?:BKG|PRJ|GK)-[A-Z0-9]+\b/)?.[0];
  let actionUrl:string|undefined;
  try{const url=new URL(input.actionUrl??"");if(url.protocol==="https:")actionUrl=url.href}catch{}
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${escape(input.subject)}</title><style>@media only screen and (max-width:600px){.outer{padding:20px 10px!important}.content{padding:28px 24px!important}.hero-title{font-size:32px!important}.brand{font-size:31px!important}.cta{display:block!important;padding:17px 16px!important}}</style></head>
  <body style="margin:0;padding:0;background:#030917;color:#ffffff;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
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
  <tr><td bgcolor="#0b1b34" class="content" style="padding:24px 40px;border:1px solid #203f6c;border-radius:0 0 20px 20px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="border-left:3px solid #428fff;padding-left:15px"><strong style="font-size:13px;color:#b7d8ff">Ci siamo, anche dopo questa email.</strong><p style="margin:6px 0 0;font-size:13px;line-height:1.7;color:#b7e4ff">Per un chiarimento puoi rispondere a questo messaggio.${reference?` Conserva il riferimento <strong style="color:#c9e2ff">${escape(reference)}</strong>.`:""}</p></td></tr></table></td></tr>
  <tr><td align="center" style="padding:24px 14px 0;font-size:11px;line-height:1.9;color:#9ed5ff"><strong style="color:#c2e8ff;letter-spacing:2px">GENKS</strong><br>Comunicazione relativa alla tua richiesta.<br><a href="https://www.prodbygenks.com" style="color:#83b9ff;text-decoration:none">prodbygenks.com</a></td></tr>
  </table></td></tr></table></body></html>`;
}

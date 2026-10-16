import "server-only";
import {Resend} from "resend";
import {italianLabel} from "@/lib/italian";
import {previewRecipientAllowed} from "@/lib/preview-mode";
import {renderGenksStudioEmail} from "@/lib/email-design";

const getResend=()=>process.env.RESEND_API_KEY?new Resend(process.env.RESEND_API_KEY):null;

export async function sendTransactionalEmail(input:{
  to:string;subject:string;heading:string;body:string;actionUrl?:string;actionLabel?:string;
  serviceRequest?:boolean;idempotencyKey?:string;
}) {
  if(!input.serviceRequest&&!previewRecipientAllowed(input.to))throw new Error("Il destinatario non è autorizzato nell’anteprima privata.");
  const resend=getResend();
  if(!resend||!process.env.RESEND_FROM_EMAIL)throw new Error("Il servizio email non è configurato.");
  const {error}=await resend.emails.send({
    from:process.env.RESEND_FROM_EMAIL,replyTo:process.env.GENKS_SUPPORT_EMAIL||process.env.GENKS_ADMIN_EMAIL,
    to:input.to,subject:input.subject,html:renderGenksStudioEmail(input),
    text:`${input.heading}\n\n${input.body}${input.actionUrl?`\n\n${input.actionLabel??"Apri"}: ${input.actionUrl}`:""}\n\nGENKS · prodbygenks.com\nPer assistenza rispondi a questa email.`,
  },input.idempotencyKey?{idempotencyKey:input.idempotencyKey}:undefined);
  if(error)throw new Error(`Transactional email failed: ${error.message}`);
  return {skipped:false as const};
}

export async function sendOrderConfirmationEmail(input:{
  to:string;customerName:string;orderId:string;orderNumber:string;paidAt:Date;totalCents:number;
  discountCents?:number;currency:string;items:Array<{beatTitle:string;licenseName:string;unitPriceCents:number}>;
  idempotencyKey?:string;
}) {
  if(!previewRecipientAllowed(input.to))throw new Error("Il destinatario non è autorizzato nell’anteprima privata.");
  const resend=getResend();
  if(!resend||!process.env.RESEND_FROM_EMAIL)throw new Error("Email dell’ordine non configurata.");
  const origin=(process.env.NEXT_PUBLIC_SITE_URL||"https://www.prodbygenks.com").replace(/\/$/,"");
  const money=(cents:number)=>new Intl.NumberFormat("it-IT",{style:"currency",currency:input.currency}).format(cents/100);
  const date=new Intl.DateTimeFormat("it-IT",{timeZone:"Europe/Rome",dateStyle:"long",timeStyle:"short"}).format(input.paidAt);
  const subject=`Pagamento confermato — ordine ${input.orderNumber} | GENKS`;
  const body=[
    "Il pagamento è stato confermato. Ecco il riepilogo del tuo acquisto.",
    `Ordine: ${input.orderNumber}`,`Data: ${date}`,
    ...input.items.map(item=>`${item.beatTitle} · ${italianLabel(item.licenseName)} — ${money(item.unitPriceCents)}`),
    ...(input.discountCents?[`Sconto applicato: −${money(input.discountCents)}`]:[]),
    `Totale: ${money(input.totalCents)}`,
    "Le licenze e i file disponibili sono nella tua raccolta. Accedi con la stessa email utilizzata per l’acquisto.",
  ].join("\n");
  const actionUrl=`${origin}/account/library`;
  const {data,error}=await resend.emails.send({
    from:process.env.RESEND_FROM_EMAIL,replyTo:process.env.GENKS_SUPPORT_EMAIL||process.env.GENKS_ADMIN_EMAIL,
    to:input.to,subject,
    html:renderGenksStudioEmail({subject,heading:"Acquisto completato.",body,actionUrl,actionLabel:"Apri la raccolta",totalLabel:"TOTALE PAGATO"}),
    text:`Acquisto completato.\n\n${body}\n\nApri la raccolta: ${actionUrl}\n\nGENKS · Per assistenza rispondi a questa email.`,
  },{idempotencyKey:input.idempotencyKey??`order-confirmation-${input.orderId}`});
  if(error)throw new Error(`Invio email dell’ordine non riuscito: ${error.message}`);
  return {skipped:false as const,emailId:data?.id??null};
}

"use server";
import {randomUUID} from "node:crypto";
import {z} from "zod";
import {Resend} from "resend";
import {requireAdmin} from "@/lib/auth";
import {renderGenksStudioEmail} from "@/lib/email-design";

export type SupportState={error?:string;sent?:boolean;nonce?:string;to?:string;subject?:string;body?:string};
const schema=z.object({to:z.email().max(254),subject:z.string().trim().min(3).max(180).regex(/^[^\r\n]+$/),body:z.string().trim().min(5).max(10000),nonce:z.uuid()});
export async function sendSupportMessage(_previous:SupportState,form:FormData):Promise<SupportState> {
  await requireAdmin();
  const raw={to:String(form.get("to")??"").trim(),subject:String(form.get("subject")??""),body:String(form.get("body")??""),nonce:String(form.get("nonce")??"")};
  const parsed=schema.safeParse(raw);
  if(!parsed.success)return {...raw,error:"Controlla destinatario, oggetto e messaggio prima di inviare."};
  const support=process.env.GENKS_SUPPORT_EMAIL;
  if(!support||!process.env.RESEND_API_KEY)return {...raw,error:"L’assistenza email non è ancora configurata."};
  const message=parsed.data;
  try {
    const {error}=await new Resend(process.env.RESEND_API_KEY).emails.send({
      from:`GENKS <${support}>`,replyTo:support,to:message.to,subject:message.subject,
      text:`${message.body}\n\nGENKS · ${support}`,
      html:renderGenksStudioEmail({subject:message.subject,heading:"Un messaggio da GENKS.",body:message.body}),
    },{idempotencyKey:`support-${message.nonce}`});
    if(error)throw new Error("Invio non confermato");
    return {sent:true,nonce:randomUUID()};
  }catch{return {...raw,error:"Invio non confermato. Il testo è conservato: controlla la posta inviata su Resend prima di riprovare. Non cambiare il testo durante un nuovo tentativo dello stesso invio."};}
}

export async function checkSupportInbox(){
 await requireAdmin();await (await import('@/lib/support-inbox')).syncSupportInbox(true);
 (await import('next/navigation')).redirect('/admin/support');
}

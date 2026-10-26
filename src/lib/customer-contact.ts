export type CustomerContact = {name:string;artistName:string;phone:string};
export type ContactContext = {userId:string;email:string;saved:CustomerContact|null;available?:boolean};
export function normalizeContact(input:unknown):CustomerContact|null {
 if(!input||typeof input!=="object")return null;
 const value=input as Record<string,unknown>;
 if([value.name,value.artistName,value.phone].some(v=>typeof v!=="string"))return null;
 const name=(value.name as string).trim(),artistName=(value.artistName as string).trim(),phone=(value.phone as string).trim();
 if(name.length<2||name.length>120||artistName.length>120||phone.length>40)return null;
 return {name,artistName,phone};
}
export function contactOwner(user:{id:string;email?:string;email_confirmed_at?:string;is_anonymous?:boolean}|null){
 return user?.id&&user.email&&user.email_confirmed_at&&!user.is_anonymous?{userId:user.id,email:user.email}:null;
}
export function contactToSave(form:FormData,user:Parameters<typeof contactOwner>[0]):CustomerContact|null{
 const owner=contactOwner(user);
 if(String(form.get("contactOwner")??"")!==(owner?.userId??""))throw new Error("contact_session_changed");
 if(form.get("saveContact")!=="on")return null;
 if(!owner||String(form.get("email")??"").trim().toLowerCase()!==owner.email.toLowerCase())throw new Error("contact_email_mismatch");
 const contact=normalizeContact(Object.fromEntries(form));
 if(!contact)throw new Error("invalid_contact");
 return contact;
}

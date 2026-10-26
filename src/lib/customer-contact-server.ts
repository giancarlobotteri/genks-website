import "server-only";
import {cache} from "react";
import {getCurrentUser} from "@/lib/auth";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {contactOwner,normalizeContact,contactToSave,type ContactContext} from "./customer-contact";
export const getContactContext=cache(async():Promise<ContactContext|null>=>{
 const owner=contactOwner(await getCurrentUser());if(!owner)return null;
 const db=await createSupabaseServerClient();
 const {data,error}=await db.from("customer_checkout_contacts").select("name,artist_name,phone").eq("user_id",owner.userId).maybeSingle();
 if(error)return {...owner,saved:null,available:false};
 return {...owner,saved:data?normalizeContact({name:data.name,artistName:data.artist_name,phone:data.phone}):null};
});
export async function saveContactChoice(form:FormData,user:Awaited<ReturnType<typeof getCurrentUser>>){
 const contact=contactToSave(form,user);if(!contact)return;
 const owner=contactOwner(user)!;
 const db=await createSupabaseServerClient();
 const {error}=await db.from("customer_checkout_contacts").upsert({user_id:owner.userId,name:contact.name,artist_name:contact.artistName,phone:contact.phone,updated_at:new Date().toISOString()},{onConflict:"user_id"});
 if(error)throw new Error("contact_save_failed");
}

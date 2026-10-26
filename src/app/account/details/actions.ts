"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {getCurrentUser} from "@/lib/auth";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {contactOwner} from "@/lib/customer-contact";
import {saveContactChoice} from "@/lib/customer-contact-server";
export async function updateContact(form:FormData){
 const user=await getCurrentUser();if(!contactOwner(user))redirect("/login?next=/account/details");
 try{await saveContactChoice(form,user);}catch{redirect("/account/details?error=save");}
 revalidatePath("/account/details");revalidatePath("/services/project");revalidatePath("/services/recording");
 redirect("/account/details?saved=1");
}
export async function removeContact(form:FormData){
 const owner=contactOwner(await getCurrentUser());if(!owner)redirect("/login?next=/account/details");
 if(form.get("contactOwner")!==owner.userId)redirect("/account/details?error=session");
 const db=await createSupabaseServerClient();
 const {error}=await db.from("customer_checkout_contacts").delete().eq("user_id",owner.userId);
 if(error)redirect("/account/details?error=remove");
 revalidatePath("/account/details");revalidatePath("/services/project");revalidatePath("/services/recording");
 redirect("/account/details?removed=1");
}

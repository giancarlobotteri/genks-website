import "server-only";
import {hasSupabase} from "@/lib/env";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { publicDiscounts } from "./public-discounts";
export const getPublicDiscounts=cache(async()=>{
 if(process.env.NODE_ENV==="development"&&!hasSupabase)return [];
 const result=await createSupabaseAdminClient().from("site_settings").select("value").eq("key","public_discounts").maybeSingle();
 if(result.error)throw new Error("Impossibile verificare il listino. Riprova tra poco.");
 return publicDiscounts(result.data?.value).filter(rule=>rule.active);
});

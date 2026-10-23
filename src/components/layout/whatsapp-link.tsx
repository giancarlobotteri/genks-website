import {GuidedAssistant} from "@/components/assistant/guided-assistant";
import {getPublicDiscounts} from "@/lib/public-discounts-server";
export async function WhatsAppLink(){
 let discounts;
 try{discounts=await getPublicDiscounts();}catch{discounts=null;}
 return <GuidedAssistant discounts={discounts}/>;
}

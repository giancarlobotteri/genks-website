import type {Metadata} from "next";
import DirectServices from "@/components/services/direct-services";
export const metadata:Metadata={title:"Servizi GENKS",description:"Registrazione, mix, master e beat su misura. Scegli il servizio e vedi il prezzo.",alternates:{canonical:"/services"}};
export default function ServicesPage(){return <DirectServices/>;}

import { MessageCircle } from "lucide-react";
import { site } from "@/config/site";
import styles from "./service-navigation.module.css";
export function WhatsAppLink() { return <a className={styles.whatsapp} href={`https://wa.me/${site.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent("Ciao GENKS, ho una domanda su")}`} target="_blank" rel="noopener noreferrer" aria-label="Contatta GENKS su WhatsApp"><MessageCircle aria-hidden="true" size={26} /></a>; }

"use client";
import { useState } from "react";
import { Instagram, MessageCircle, Copy, Check } from "lucide-react";
import { site } from "@/config/site";

export const customBeatMessage = "Ciao, sono interessato a un beat su misura. Possiamo concordare il prezzo?";

export function CustomBeatContact() {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const phone = site.whatsapp.replace(/\D/g, "");
  const handle = new URL(site.instagram).pathname.split("/").filter(Boolean)[0];
  async function copy() {
    try { await navigator.clipboard.writeText(customBeatMessage); setCopied(true); setCopyError(false); }
    catch { setCopyError(true); }
  }
  return <section className="custom-beat-contact">
    <span className="eyebrow">PRODUZIONE PERSONALE</span><h2>Il tuo beat, da zero.</h2>
    <p>100 €. Anticipo 50 € con carta o contanti; saldo 50 € prima dei file definitivi. Una revisione inclusa. Split 50/50; il 100% richiede preventivo.</p>
    <div className="custom-contact-actions">
      {phone ? <a className="button button-primary" href={`https://wa.me/${phone}?text=${encodeURIComponent(customBeatMessage)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={18}/> Parliamone su WhatsApp</a> : <p className="muted">WhatsApp sarà disponibile appena configurato. Puoi scrivermi su Instagram.</p>}
      <button type="button" className="button button-secondary" onClick={copy}>{copied ? <Check size={17}/> : <Copy size={17}/>} {copied ? "Messaggio copiato" : "Copia il messaggio per i DM"}</button>
      <a className="button button-secondary" href={`https://ig.me/m/${handle}`} target="_blank" rel="noopener noreferrer" onClick={() => void copy()}><Instagram size={18}/> Apri i DM di Instagram</a>
    </div>
    <small role="status">{copyError ? "Non è stato possibile copiare il messaggio. Puoi scrivermi direttamente nei DM." : "Per Instagram il messaggio viene copiato: incollalo nella conversazione. WhatsApp lo apre già compilato."}</small>
  </section>;
}

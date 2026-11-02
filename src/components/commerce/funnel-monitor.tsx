"use client";
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import Link from 'next/link';
import {funnelService} from '@/lib/funnel';
import {FUNNEL_CONSENT,hasFunnelConsent,setFunnelConsent,trackFunnel} from '@/lib/funnel-client';
import styles from './funnel-monitor.module.css';
export function FunnelMonitor(){
 const path=usePathname(),[open,setOpen]=useState(false),[enabled,setEnabled]=useState(false);
 useEffect(()=>{
  const sync=()=>{setEnabled(hasFunnelConsent());setOpen(!document.cookie.split('; ').some(c=>c.startsWith(FUNNEL_CONSENT+'=')));};
  const show=()=>setOpen(true);sync();window.addEventListener('genks:stats-consent',sync);window.addEventListener('genks:stats-settings',show);
  return()=>{window.removeEventListener('genks:stats-consent',sync);window.removeEventListener('genks:stats-settings',show);};
 },[]);
 useEffect(()=>{
  if(!enabled||path.startsWith('/admin'))return;
  const visit=()=>{const service=funnelService(location.pathname,new URLSearchParams(location.search));if(!service)return;if(service==='cart')trackFunnel('checkout_viewed');else trackFunnel('service_selected',service);};visit();
  const click=(e:MouseEvent)=>{const link=(e.target as Element)?.closest?.('a[href]');if(!link)return;const url=new URL(link.getAttribute('href')!,location.href);if(url.origin!==location.origin)return;const service=funnelService(url.pathname,url.searchParams);if(service&&service!=='cart')trackFunnel('service_selected',service);};
  const start=(e:Event)=>{if(!(e.target instanceof Element)||!e.target.closest('#main-content input,#main-content select,#main-content textarea,#main-content .studio-duration-control button,#main-content .artist-stepper button,#main-content .tracks-control button,#main-content .booking-days button,#main-content .slot-grid button,#main-content .payment-choice'))return;const s=funnelService(location.pathname,new URLSearchParams(location.search));if(s&&s!=='cart')trackFunnel('form_started',s);};
  document.addEventListener('click',click);document.addEventListener('change',start);document.addEventListener('click',start);
  return()=>{document.removeEventListener('click',click);document.removeEventListener('change',start);document.removeEventListener('click',start);};
 },[path,enabled]);
 if(path.startsWith('/admin')||!open)return null;
 return <section className={styles.panel} aria-label="Statistiche facoltative"><strong>Ci aiuti a migliorare GENKS?</strong><p>Con il tuo consenso misuriamo i passaggi verso l’acquisto. Nessun nome, email, testo digitato o dato della carta nelle statistiche. Puoi continuare anche senza accettare.</p><p><Link href="/legal/cookies">Dettagli e durata</Link> · Puoi cambiare scelta dal fondo della pagina.</p><div><button type="button" onClick={()=>{setFunnelConsent(false);setOpen(false);}}>Rifiuta statistiche</button><button type="button" onClick={()=>{setFunnelConsent(true);setOpen(false);}}>Accetta statistiche</button></div><button className={styles.close} type="button" aria-label="Chiudi senza accettare statistiche" onClick={()=>{setFunnelConsent(false);setOpen(false);}}>×</button></section>;
}
export function FunnelPreferences(){return <button type="button" className="text-link" onClick={()=>window.dispatchEvent(new Event('genks:stats-settings'))}>Preferenze statistiche</button>;}

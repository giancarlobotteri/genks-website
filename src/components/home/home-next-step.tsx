"use client";
import Link from 'next/link';
import {AudioLines,ArrowUpRight,Sparkles} from 'lucide-react';
export function HomeNextStep(){return <aside className="home-next-step" aria-label="Il tuo percorso GENKS"><span><AudioLines size={16}/>DAL PROGETTO AL BRANO</span><h2>Un suono tuo.<br/>Un percorso chiaro.</h2><ul><li>In studio o a distanza</li><li>Prezzo prima del pagamento</li><li>Una revisione inclusa</li></ul><button type="button" onClick={()=>window.dispatchEvent(new Event('genks:assistant-open'))}><Sparkles size={16}/>Trova il servizio adatto<ArrowUpRight size={16}/></button><Link href="/guida/tracce">Prepara le tue tracce ↗</Link></aside>;}

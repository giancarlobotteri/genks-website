"use client";
import {type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {ArrowUpRight} from 'lucide-react';
import {HomeCartPreview} from '../services/service-cart-rail-v8';
import {AssistantAvatar} from './assistant-avatar';
import type {PublicDiscount} from '@/lib/public-discounts';
export function UtilityDock({children,discounts=[],assistantEnabled=false}:{children:ReactNode;discounts?:PublicDiscount[];assistantEnabled?:boolean}){
 const pathname=usePathname(),home=pathname==='/',services=pathname.startsWith('/services');

 if(home)return <div className="utility-anchor" data-home={true}>{children}</div>;
 if(pathname.startsWith('/admin'))return children;
 return <div className="utility-anchor" data-home={false} data-services={services} data-docked={false}><div className="utility-tools" role="group" aria-label="Carrello e assistente GENKS">{children}</div><aside className="utility-workspace" aria-label="Assistente e carrello">{assistantEnabled&&<section className="assistant-preview"><header><span className="assistant-preview-avatar"><AssistantAvatar size={28}/></span><strong>Assistente GENKS</strong><span>Virtuale</span></header><div><h2>Hai domande?<br/>Parliamone qui.</h2><p>Servizi, prezzi e disponibilità. Ti aiuto a comporre il progetto, poi confermi il riepilogo.</p></div><button type="button" aria-haspopup="dialog" onClick={()=>window.dispatchEvent(new Event('genks:open-chat'))}>Chiedi all’assistente <ArrowUpRight size={17}/></button></section>}{!services&&<HomeCartPreview embedded discounts={discounts}/>}</aside></div>;
}


"use client";
import {useEffect,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {ArrowUpRight} from 'lucide-react';
import {HomeCartPreview} from '../services/service-cart-rail-v8';
import {AssistantAvatar} from './assistant-avatar';
import type {PublicDiscount} from '@/lib/public-discounts';
export function UtilityDock({children,discounts=[],assistantEnabled=false}:{children:ReactNode;discounts?:PublicDiscount[];assistantEnabled?:boolean}){
 const pathname=usePathname(),home=pathname==='/',services=pathname.startsWith('/services'),[docked,setDocked]=useState(false);
 useEffect(()=>{if(!home)return;const footer=document.querySelector('.site-footer');if(!footer)return;const observer=new IntersectionObserver(([entry])=>setDocked(entry.isIntersecting),{threshold:0});observer.observe(footer);return()=>observer.disconnect();},[home]);
 if(pathname.startsWith('/admin'))return children;
 return <div className="utility-anchor" data-home={home} data-services={services} data-docked={home&&docked}><div className="utility-tools" role="group" aria-label="Carrello e assistente GENKS">{children}</div><aside className="utility-workspace" aria-label="Assistente e carrello">{assistantEnabled&&<section className="assistant-preview"><header><AssistantAvatar size={28}/><strong>Assistente GENKS</strong><span>Virtuale</span></header><div><h2>Hai domande?<br/>Parliamone qui.</h2><p>Servizi, prezzi e disponibilità. Ti aiuto a comporre il progetto, poi confermi il riepilogo.</p></div><button type="button" onClick={()=>window.dispatchEvent(new Event('genks:open-chat'))}>Chiedi all’assistente <ArrowUpRight size={17}/></button></section>}{!services&&<HomeCartPreview embedded discounts={discounts}/>}</aside></div>;
}

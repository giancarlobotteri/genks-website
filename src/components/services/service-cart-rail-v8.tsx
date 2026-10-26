"use client";
import type {PublicDiscount} from "@/lib/public-discounts";
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ShoppingBag} from 'lucide-react';
import {serviceCartKey} from '@/lib/service-cart-storage';
import {quoteOrder,type OrderSelection} from '@/lib/service-order-v8';
import {serviceAmount} from '@/lib/service-rates';
export function ServiceCartRailV8({discounts=[]}:{discounts?:PublicDiscount[]}){
 const [items,setItems]=useState<OrderSelection[]>([]),[open,setOpen]=useState(false);
 useEffect(()=>{let current=true;const update=async()=>{try{const key=await serviceCartKey();const list=JSON.parse(sessionStorage.getItem(key)??'[]');if(current)setItems(Array.isArray(list)?list:[]);}catch{if(current)setItems([]);}};void update();addEventListener('genks-services-cart',update);return()=>{current=false;removeEventListener('genks-services-cart',update);};},[]);
 let q:ReturnType<typeof quoteOrder>|undefined;try{if(items.length)q=quoteOrder(items,true,new Date(),discounts);}catch{}
 return <><button type="button" className="cart-rail-toggle" aria-expanded={open} aria-controls="services-cart-home" onClick={()=>setOpen(!open)}><ShoppingBag size={19}/><span>Carrello servizi · {items.length}</span></button><aside id="services-cart-home" className={`cart-rail ${open?'is-open':''}`} aria-label="Carrello servizi"><div className="cart-rail-heading"><h2>Il tuo carrello</h2><button type="button" onClick={()=>setOpen(false)} aria-label="Chiudi carrello servizi">×</button></div>{q?q.parts.map((p,i)=><p key={i}>{p.title}<strong>{serviceAmount(p.total)}</strong></p>):<p>Scegli un servizio e aggiungilo al carrello, oppure acquistalo subito.</p>}<Link className="button button-primary" href="/services/checkout">Apri e controlla il totale</Link><Link href="/services">Scegli altri servizi</Link></aside></>;
}

"use client";
import {useEffect,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
export function UtilityDock({children}:{children:ReactNode}){
 const home=usePathname()==='/',[docked,setDocked]=useState(false);
 useEffect(()=>{if(!home)return;const footer=document.querySelector('.site-footer');if(!footer)return;const observer=new IntersectionObserver(([entry])=>setDocked(entry.isIntersecting),{threshold:0});observer.observe(footer);return()=>observer.disconnect();},[home]);
 return <div className="utility-anchor" data-home={home} data-docked={home&&docked}><div className="utility-tools" role="group" aria-label="Carrello e assistente GENKS">{children}</div></div>;
}

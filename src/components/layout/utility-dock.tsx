"use client";
import {useEffect,useState,type ReactNode} from 'react';
export function UtilityDock({children}:{children:ReactNode}){const [docked,setDocked]=useState(false);useEffect(()=>{const footer=document.querySelector('.site-footer');if(!footer)return;const observer=new IntersectionObserver(([entry])=>setDocked(entry.isIntersecting),{threshold:0});observer.observe(footer);return()=>observer.disconnect();},[]);return <div className="utility-anchor" data-docked={docked}><div className="utility-tools">{children}</div></div>;}

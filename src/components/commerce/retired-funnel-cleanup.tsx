"use client";
import {useEffect} from 'react';
/** Removal only: no collection, request or identifier creation. */
export function RetiredFunnelCleanup(){
 useEffect(()=>{
  document.cookie='genks_stats_consent=; Path=/; Max-Age=0; SameSite=Lax'+(location.protocol==='https:'?'; Secure':'');
  try{sessionStorage.removeItem('genks:funnel:v1');}catch{}
 },[]);
 return null;
}

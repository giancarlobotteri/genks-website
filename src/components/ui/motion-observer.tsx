"use client";
import {useEffect,useRef} from 'react';
import {usePathname} from 'next/navigation';
export function MotionObserver(){
 const pathname=usePathname(),wash=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover: hover) and (pointer: fine)');
  const elements=[...document.querySelectorAll<HTMLElement>('[data-reveal]')],entry=document.getElementById('main-content');
  const compact=innerWidth<900||!fine.matches;
  const animations:Animation[]=[];let exit:Animation|undefined,restore:ReturnType<typeof setTimeout>|undefined,frame=0,lastPaint=0,x=0,y=0,lastX=-100,lastY=-100;
  const disclosures=new Set<Animation>();
  if(!reduced.matches&&!document.hidden&&pathname!=='/'){
   if(entry&&!compact)animations.push(entry.animate([{opacity:.8},{opacity:1}],{duration:340,easing:'cubic-bezier(.2,.7,.2,1)'}));
   if(!compact&&wash.current)animations.push(wash.current.animate([{opacity:0,transform:'translate3d(-65%,0,0)'},{opacity:.28,offset:.3},{opacity:0,transform:'translate3d(65%,0,0)'}],{duration:480,easing:'cubic-bezier(.2,.7,.2,1)'}));
   // Reveal sections and service panels already own an entrance; do not animate them twice.
   [...document.querySelectorAll<HTMLElement>('#main-content .service-form-heading,#main-content .admin-form-card,#main-content .service-choice-card,#main-content .portal-shell>h1,#main-content .admin-heading')].filter(e=>{const r=e.getBoundingClientRect();return !e.closest('[data-reveal]')&&r.top<innerHeight&&r.bottom>0;}).slice(0,compact?2:4).forEach((card,i)=>animations.push(card.animate([{opacity:compact?.82:1,transform:'translate3d(0,6px,0)'},{opacity:1,transform:'translate3d(0,0,0)'}],{duration:320,delay:i*35,easing:'cubic-bezier(.2,.7,.2,1)'})));
  }
  const leave=(event:MouseEvent)=>{
   if(reduced.matches||pathname==='/'||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   const anchor=event.target instanceof Element?event.target.closest('a'):null;if(!anchor||anchor.target==='_blank'||anchor.hasAttribute('download'))return;
   const target=new URL(anchor.href,location.href);
   if(target.origin!==location.origin||target.pathname.startsWith('/api/')||target.pathname===location.pathname&&target.search===location.search)return;
   exit?.cancel();exit=entry?.animate([{opacity:1},{opacity:.86}],{duration:110,fill:'forwards',easing:'ease-out'});clearTimeout(restore);restore=setTimeout(()=>exit?.cancel(),1000);
  };
  const paint=(time:number)=>{
   if(reduced.matches||document.hidden||!fine.matches||innerWidth<900){frame=0;return;}
   if(time-lastPaint<34){frame=requestAnimationFrame(paint);return;}
   frame=0;lastPaint=time;
   if(Math.abs(x-lastX)<4&&Math.abs(y-lastY)<4)return;
   lastX=x;lastY=y;document.documentElement.style.setProperty('--pointer-x',`${x}px`);document.documentElement.style.setProperty('--pointer-y',`${y}px`);
  };
  const move=(event:PointerEvent)=>{if(reduced.matches||!fine.matches||innerWidth<900||event.pointerType!=='mouse'||document.hidden)return;x=event.clientX;y=event.clientY;if(!frame)frame=requestAnimationFrame(paint);};
  // Reveal once: scrolling back must never hide a price or restart a whole section.
  const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.remove('reveal-pending');observer.unobserve(e.target);}}),{threshold:.06});
  const expand=(event:Event)=>{
   const details=event.target;
   if(reduced.matches||document.hidden||!(details instanceof HTMLDetailsElement)||!details.open)return;
   [...details.children].filter((child):child is HTMLElement=>child instanceof HTMLElement&&child.tagName!=='SUMMARY').slice(0,4).forEach((child,i)=>{
    const animation=child.animate([{opacity:.5,transform:'translate3d(0,5px,0)'},{opacity:1,transform:'translate3d(0,0,0)'}],{duration:220,delay:i*25,easing:'cubic-bezier(.2,.7,.2,1)'});
    disclosures.add(animation);animation.onfinish=()=>disclosures.delete(animation);
   });
  };
  const observe=()=>{if(reduced.matches){animations.forEach(a=>a.cancel());disclosures.forEach(a=>a.cancel());disclosures.clear();exit?.cancel();cancelAnimationFrame(frame);frame=0;observer.disconnect();elements.forEach(e=>e.classList.remove('reveal-pending'));}else elements.forEach(e=>{if(e.getBoundingClientRect().top>innerHeight)e.classList.add('reveal-pending');observer.observe(e);});};
  observe();reduced.addEventListener('change',observe);document.addEventListener('click',leave,true);document.addEventListener('toggle',expand,true);
  const pointerEnabled=!pathname.startsWith('/admin');if(pointerEnabled)window.addEventListener('pointermove',move,{passive:true});
  return()=>{animations.forEach(a=>a.cancel());disclosures.forEach(a=>a.cancel());disclosures.clear();exit?.cancel();clearTimeout(restore);cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('click',leave,true);document.removeEventListener('toggle',expand,true);window.removeEventListener('pointermove',move);reduced.removeEventListener('change',observe);elements.forEach(e=>e.classList.remove('reveal-pending'));};
 },[pathname]);
 return <div className="route-transition-light" aria-hidden="true" ref={wash}/>;
}

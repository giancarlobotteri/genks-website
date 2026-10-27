"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function MotionObserver() {
  const pathname = usePathname();
  const wash=useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const entry=document.getElementById("main-content");
    const entrance=media.matches||pathname==='/'?null:entry?.animate([{opacity:.72},{opacity:1}],{duration:440,easing:"cubic-bezier(.2,.7,.2,1)"});
    const light=media.matches||pathname==='/'?null:wash.current?.animate([{opacity:0,transform:'translate3d(-65%,0,0)'},{opacity:.45,offset:.3},{opacity:0,transform:'translate3d(65%,0,0)'}],{duration:650,easing:'cubic-bezier(.2,.7,.2,1)'});
    const cards=media.matches||pathname==='/'?[]:[...document.querySelectorAll<HTMLElement>('#main-content .service-form-heading,#main-content .service-config-card,#main-content .admin-form-card,#main-content .service-choice-card')].slice(0,8).map((card,i)=>card.animate([{opacity:.65,transform:'translate3d(0,9px,0)'},{opacity:1,transform:'translate3d(0,0,0)'}],{duration:400,delay:Math.min(i*35,140),easing:'cubic-bezier(.2,.7,.2,1)'}));
    let exit:Animation|undefined;let restore:ReturnType<typeof setTimeout>|undefined;
    const leave=(event:MouseEvent)=>{
      if(media.matches||pathname==='/'||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      const anchor=event.target instanceof Element?event.target.closest('a'):null;
      if(!anchor||anchor.target==='_blank'||anchor.hasAttribute('download'))return;
      const target=new URL(anchor.href,location.href);
      if(target.origin!==location.origin||target.pathname.startsWith('/api/')||target.pathname===location.pathname&&target.search===location.search)return;
      exit?.cancel();exit=entry?.animate([{opacity:1},{opacity:.8}],{duration:130,fill:'forwards',easing:'ease-out'});
      clearTimeout(restore);restore=setTimeout(()=>exit?.cancel(),1000);
    };
    document.addEventListener('click',leave,true);
    let frame = 0;
    const move = (event: PointerEvent) => {
      if (media.matches) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        document.documentElement.style.setProperty("--pointer-x", `${event.clientX}px`);
        document.documentElement.style.setProperty("--pointer-y", `${event.clientY}px`);
        document.documentElement.style.setProperty("--pointer-nx", `${event.clientX / window.innerWidth - 0.5}`);
        document.documentElement.style.setProperty("--pointer-ny", `${event.clientY / window.innerHeight - 0.5}`);
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    if (media.matches)
      return () => {
        window.removeEventListener("pointermove", move);
        document.removeEventListener('click',leave,true);
      };
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          entry.target.classList.toggle("reveal-pending", !entry.isIntersecting);
        }),
      { threshold: 0.06 },
    );
    elements.forEach((element) => {
      if (element.getBoundingClientRect().top > window.innerHeight)
        element.classList.add("reveal-pending");
      observer.observe(element);
    });
    const revealAll = () => {
      if (media.matches)
        elements.forEach((element) =>
          element.classList.remove("reveal-pending"),
        );
    };
    media.addEventListener("change", revealAll);
    return () => {
      entrance?.cancel();light?.cancel();cards.forEach(a=>a.cancel());exit?.cancel();clearTimeout(restore);document.removeEventListener('click',leave,true);
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      media.removeEventListener("change", revealAll);
      elements.forEach((element) => element.classList.remove("reveal-pending"));
    };
  }, [pathname]);
  return <div className="route-transition-light" aria-hidden="true" ref={wash}/>;
}

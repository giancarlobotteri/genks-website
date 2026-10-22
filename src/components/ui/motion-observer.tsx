"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function MotionObserver() {
  const pathname = usePathname();
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const entry=document.getElementById("main-content");
    const entrance=media.matches?null:entry?.animate([{opacity:.45,transform:"translate3d(0,12px,0)"},{opacity:1,transform:"translate3d(0,0,0)"}],{duration:520,easing:"cubic-bezier(.2,.7,.2,1)"});
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
      entrance?.cancel();
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      media.removeEventListener("change", revealAll);
      elements.forEach((element) => element.classList.remove("reveal-pending"));
    };
  }, [pathname]);
  return null;
}

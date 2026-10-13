import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function Hero() {
  return (
    <section id="home" className="hero sales-hero logo-first-hero" aria-labelledby="hero-title">
      <div className="container hero-content">
      <h1 id="hero-title" className="sr-only">GENKS — Il suono nasce qui</h1>
      <div className="hero-art">
        <Image
          src="/brand/genks-logo.jpeg"
          alt="GENKS"
          fill
          preload
          sizes="(max-width: 700px) 90vw, 560px"
          quality={85}
        />
      </div>
        <div className="hero-topline">
          <span className="eyebrow">
            <span className="blue-line" />
            PRODUTTORE MUSICALE INDIPENDENTE
          </span>
          <span className="mono hero-coordinate">
            SUONO / VISIONE / ISTINTO
          </span>
        </div>
        <div className="hero-actions" data-reveal>
          <Link className="button button-primary magnetic-cta" href="#catalog">
            ESPLORA I BEAT <ArrowUpRight size={20} aria-hidden="true" />
          </Link>
          <Link className="button button-secondary" href="/services">PRENOTA UNA SESSIONE <ArrowUpRight size={18} aria-hidden="true" /></Link>
        </div>
      </div>
    </section>
  );
}

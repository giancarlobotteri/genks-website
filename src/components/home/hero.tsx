import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";

export function Hero() {
  return (
    <section id="home" className="hero sales-hero logo-first-hero" aria-labelledby="hero-title">
      <div className="hero-ambient" aria-hidden="true">
        <span className="hero-light hero-light-one" />
        <span className="hero-light hero-light-two" />
      </div>
      <div className="container hero-content">
      <h1 id="hero-title" className="sr-only">GENKS — The sound starts here</h1>
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
      <div className="hero-grain" aria-hidden="true" />
        <div className="hero-topline">
          <span className="eyebrow">
            <span className="blue-line" />
            INDEPENDENT MUSIC PRODUCER
          </span>
          <span className="mono hero-coordinate">
            SOUND / VISION / INSTINCT
          </span>
        </div>
        <div className="hero-actions" data-reveal>
          <Link className="button button-primary magnetic-cta" href="#catalog">
            EXPLORE BEATS <ArrowUpRight size={20} aria-hidden="true" />
          </Link>
          <Link className="button button-secondary" href="/services">BOOK A SESSION <ArrowUpRight size={18} aria-hidden="true" /></Link>
        </div>
        <div className="hero-energy" aria-hidden="true">
          {Array.from({ length: 22 }, (_, index) => (
            <i key={index} style={{ "--bar-index": index } as React.CSSProperties} />
          ))}
        </div>
        <div className="hero-bottom">
          <a href="#featured" className="scroll-cue">
            <ArrowDown size={15} />
            <span>SCROLL TO DISCOVER</span>
          </a>
        </div>
      </div>
    </section>
  );
}

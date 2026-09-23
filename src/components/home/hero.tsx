import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { PlayButton } from "@/components/beats/play-button";
import type { Beat } from "@/types/domain";

export function Hero({ beats }: { beats: Beat[] }) {
  const firstBeat = beats[0];
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-ambient" aria-hidden="true">
        <span className="hero-light hero-light-one" />
        <span className="hero-light hero-light-two" />
      </div>
      <div className="hero-art" aria-hidden="true">
        <Image
          src="/icon.svg"
          alt=""
          fill
          preload
          sizes="(max-width: 700px) 140vw, 100vw"
          quality={85}
        />
      </div>
      <div className="hero-grain" aria-hidden="true" />
      <div className="container hero-content">
        <div className="hero-topline">
          <span className="eyebrow">
            <span className="blue-line" />
            INDEPENDENT MUSIC PRODUCER
          </span>
          <span className="mono hero-coordinate">
            SOUND / VISION / INSTINCT
          </span>
        </div>
        <div className="hero-title-wrap" data-reveal>
          <h1 id="hero-title" className="sr-only">GENKS</h1>
          <span className="hero-title-caption mono">
            WELCOME
          </span>
        </div>
        <div className="hero-copy" data-reveal>
          <p className="hero-focus-copy">BEATS &amp; PRODUCTION</p>
        </div>
        <div className="hero-actions" data-reveal>
          <Link className="button button-primary" href="/beats">
            EXPLORE BEATS <ArrowUpRight size={20} aria-hidden="true" />
          </Link>
          <Link className="button button-secondary" href="/services">BOOK / SERVICES <ArrowUpRight size={18} /></Link>
          {firstBeat && (
            <div className="hero-listen">
              <PlayButton beat={firstBeat} queue={beats} />
              <span>
                Press play.<small>Enter the sound.</small>
              </span>
            </div>
          )}
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

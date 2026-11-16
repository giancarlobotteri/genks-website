import { lazy, Suspense, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Admin } from "./components/Admin.tsx";
import { GenksSymbol } from "./components/brand.tsx";
import { BeatStore } from "./components/BeatStore.tsx";
import { Bundles } from "./components/Bundles.tsx";
import { CustomBeat } from "./components/CustomBeat.tsx";
import { Intro } from "./components/Intro.tsx";
import { PanelHost } from "./components/Panels.tsx";
import { Player } from "./components/Player.tsx";
import { TopNav, type NavItem } from "./components/TopNav.tsx";
import { DemoBadge, prefersReducedMotion } from "./components/ui.tsx";
import { WaveBridge } from "./components/WaveBridge.tsx";
import { StudioProvider, useStudio } from "./store.tsx";
import s from "./styles/vs.module.css";

// The 3D engine is the heaviest part: load it in parallel so the page shell appears immediately.
const StudioStage = lazy(() => import("./components/StudioStage.tsx").then(m => ({ default: m.StudioStage })));

const subscribeHash = (cb: () => void) => { window.addEventListener("hashchange", cb); return () => window.removeEventListener("hashchange", cb); };
const useRoute = () => useSyncExternalStore(subscribeHash, () => (window.location.hash.startsWith("#/gestione") ? "admin" : "studio"), () => "studio");

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

function Studio() {
  const { open } = useStudio();
  const [introDone, setIntroDone] = useState(() => { try { return sessionStorage.getItem("genks:vs:intro") === "1"; } catch { return false; } });
  const [lite, setLite] = useState(() => { try { return localStorage.getItem("genks:vs:lite") === "1" || !webglAvailable(); } catch { return !webglAvailable(); } });
  const toggleLite = useCallback(() => setLite(v => { try { localStorage.setItem("genks:vs:lite", v ? "0" : "1"); } catch { /* ignore */ } return !v; }), []);

  useEffect(() => { document.documentElement.dataset.vsIntro = introDone ? "done" : "on"; }, [introDone]);

  const items: NavItem[] = [
    { label: "Studio", go: () => scrollTo("studio") },
    { label: "Registrazione", go: () => open({ type: "recording" }) },
    { label: "Mix & Master", go: () => open({ type: "mix" }) },
    { label: "Beat Store", go: () => scrollTo("beat-store") },
    { label: "Beat su misura", go: () => scrollTo("beat-su-misura") },
    { label: "Pacchetti", go: () => scrollTo("bundle") },
  ];

  return (
    <>
      {!introDone && <Intro onDone={() => setIntroDone(true)} links={items.slice(1)} />}
      <TopNav items={items} lite={lite} onToggleLite={toggleLite} adminHref="#/gestione" />
      <main id="top">
        <Suspense fallback={<section id="studio" className={s.stageLoading} aria-busy="true"><p>Carico lo studio…</p></section>}>
          <StudioStage introDone={introDone} lite={lite} onWebglFail={() => setLite(true)} />
        </Suspense>
        {!lite && <WaveBridge />}
        <BeatStore />
        <CustomBeat />
        <Bundles />
      </main>
      <footer className={s.footer}>
        <GenksSymbol size={40} />
        <p><strong>GENKS Virtual Studio</strong> · prototipo FREE <DemoBadge /></p>
        <p className={s.muted}>Prezzi, licenze, disponibilità e pacchetti sono dati dimostrativi. Nessun pagamento, prenotazione, upload o download reale è attivo. Anteprime audio originali sintetizzate nel browser.</p>
        <p><a href="#/gestione">Gestione contenuti (demo)</a></p>
      </footer>
    </>
  );
}

export default function App() {
  const route = useRoute();
  useEffect(() => { if (route === "admin") window.scrollTo(0, 0); }, [route]);
  return (
    <StudioProvider>
      <div className={s.root}>
        <a className={s.skip} href={route === "admin" ? "#admin" : "#beat-store"}>{route === "admin" ? "Vai alla gestione" : "Salta al Beat Store"}</a>
        {route === "admin" ? <main id="admin"><Admin backHref="#top" /></main> : <Studio />}
        <PanelHost />
        <Player />
      </div>
    </StudioProvider>
  );
}

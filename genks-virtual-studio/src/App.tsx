import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { Admin } from "./components/Admin.tsx";
import { GenksSymbol } from "./components/brand.tsx";
import { BeatStore } from "./components/BeatStore.tsx";
import { Bundles } from "./components/Bundles.tsx";
import { Intro } from "./components/Intro.tsx";
import { PanelHost } from "./components/Panels.tsx";
import { Player } from "./components/Player.tsx";
import { TopNav, type NavItem } from "./components/TopNav.tsx";
import { DemoBadge } from "./components/ui.tsx";
import { travelTo, travelToId } from "./lib/stepper.ts";
import { BeatBurst, enterStore } from "./components/BeatBurst.tsx";
import { StudioProvider, useStudio } from "./store.tsx";
import s from "./styles/vs.module.css";

// The 3D engine is the heaviest part: load it in parallel so the page shell appears immediately.
const goToStop = (id: "mic" | "daw" | "mix") => import("./components/StudioStage.tsx").then(m => m.travelToStop(id, 2200));
const StudioStage = lazy(() => import("./components/StudioStage.tsx").then(m => ({ default: m.StudioStage })));

const subscribeHash = (cb: () => void) => { window.addEventListener("hashchange", cb); return () => window.removeEventListener("hashchange", cb); };
const useRoute = () => useSyncExternalStore(subscribeHash, () => (window.location.hash.startsWith("#/gestione") ? "admin" : "studio"), () => "studio");


function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

function Studio() {
  const { open } = useStudio();
  const [introDone, setIntroDone] = useState(() => { try { return sessionStorage.getItem("genks:vs:intro") === "1"; } catch { return false; } });
  // No "light mode" switch: the 2D fallback appears only if this browser cannot run WebGL at all.
  const [noGl, setNoGl] = useState(() => !webglAvailable());

  useEffect(() => { document.documentElement.dataset.vsIntro = introDone ? "done" : "on"; }, [introDone]);

  const items: NavItem[] = [
    { label: "Studio", go: () => void travelTo(0) },
    // services: the camera first travels to the object, then the panel opens on it
    { label: "Registrazione", go: () => void goToStop("mic").then(() => open({ type: "recording" })) },
    { label: "Beat su misura", go: () => void goToStop("daw").then(() => open({ type: "custom" })) },
    { label: "Mix & Master", go: () => void goToStop("mix").then(() => open({ type: "mix" })) },
    { label: "Beat Store", go: () => void enterStore() },
    { label: "Pacchetti", go: () => void travelToId("bundle") },
  ];

  return (
    <>
      {!introDone && <Intro onDone={() => setIntroDone(true)} links={items.slice(1)} />}
      <TopNav items={items} adminHref="#/gestione" />
      <main id="top">
        <Suspense fallback={<section id="studio" className={s.stageLoading} aria-busy="true"><p>Carico lo studio…</p></section>}>
          <StudioStage introDone={introDone} noGl={noGl} onWebglFail={() => setNoGl(true)} />
        </Suspense>
        <BeatStore />
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
        <BeatBurst />
        <Player />
      </div>
    </StudioProvider>
  );
}

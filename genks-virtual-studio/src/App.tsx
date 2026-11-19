import { lazy, Suspense, useEffect, useState } from "react";
import { PanelHost } from "./components/Panels.tsx";
import { Player } from "./components/Player.tsx";
import { Reel } from "./components/Reel.tsx";
import { ServiceScreen } from "./components/ServiceScreen.tsx";
import { StoreScreen } from "./components/StoreScreen.tsx";
import { TopNav, type NavItem } from "./components/TopNav.tsx";
import { useDirector } from "./lib/director.ts";
import { bindNav, enterStore, goService, goStudio, replayReel } from "./lib/nav.ts";
import { StudioProvider, useStudio } from "./store.tsx";
import s from "./styles/vs.module.css";

// The 3D engine is the heaviest part: load it in parallel so the page shell appears immediately.
const StudioStage = lazy(() => import("./components/StudioStage.tsx").then(m => ({ default: m.StudioStage })));


function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

function Studio() {
  const { open, close } = useStudio();
  const { screen } = useDirector();
  // No "light mode" switch: the 2D fallback appears only if this browser cannot run WebGL at all.
  const [noGl, setNoGl] = useState(() => !webglAvailable());
  useEffect(() => { bindNav(open, close); }, [open, close]);

  // every menu entry is a camera move, from wherever the user is
  const items: NavItem[] = [
    { label: "Anteprima", go: replayReel },
    { label: "Studio", go: () => void goStudio(0) },
    { label: "Registrazione", go: () => void goService("recording") },
    { label: "Beat su misura", go: () => void goService("custom") },
    { label: "Mix & Master", go: () => void goService("mix") },
    { label: "Beat Store", go: () => void enterStore("beats") },
    { label: "Pacchetti", go: () => void enterStore("bundles") },
  ];

  return (
    <>
      {screen !== "reel" && <TopNav items={items} />}
      <main id="top" className={s.screens}>
        <Suspense fallback={<section id="studio" className={s.stageLoading} aria-busy="true"><p>Carico lo studio…</p></section>}>
          <StudioStage noGl={noGl} onWebglFail={() => setNoGl(true)} />
        </Suspense>
        {screen === "reel" && <Reel />}
        <ServiceScreen />
        <StoreScreen />
      </main>
    </>
  );
}

export default function App() {
  return (
    <StudioProvider>
      <div className={s.root}>
        <a className={s.skip} href="#main-menu">Vai al menu</a>
        <Studio />
        <PanelHost />
        <Player />
      </div>
    </StudioProvider>
  );
}

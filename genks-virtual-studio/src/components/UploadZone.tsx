import { FileAudio, UploadCloud, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import s from "../styles/vs.module.css";
import { DemoBadge } from "./ui.tsx";

type Item = { id: string; name: string; size: number; progress: number };

const fmtSize = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} kB`);

/**
 * Drag & drop with selection states and a SIMULATED progress bar.
 * Files are never read, uploaded or stored: only their names/sizes are shown.
 */
export function UploadZone({ onChange }: { onChange: (names: string[]) => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);
  const inputId = useId();
  const timer = useRef<number | null>(null);

  useEffect(() => { onChange(items.map(i => i.name)); }, [items, onChange]);
  useEffect(() => {
    if (!items.some(i => i.progress < 100)) return;
    timer.current = window.setInterval(() => {
      setItems(list => list.map(i => (i.progress < 100 ? { ...i, progress: Math.min(100, i.progress + 7 + Math.random() * 14) } : i)));
    }, 180);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [items]);

  const add = (files: FileList | null) => {
    if (!files) return;
    setItems(list => [...list, ...Array.from(files).map(f => ({ id: `${f.name}-${f.size}-${Math.random()}`, name: f.name, size: f.size, progress: 0 }))]);
  };

  return (
    <div className={s.upload}>
      <div
        className={s.dropzone}
        data-drag={drag || undefined}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
      >
        <UploadCloud size={28} aria-hidden="true" />
        <p><strong>Trascina qui stems o file audio</strong> oppure</p>
        <label htmlFor={inputId} className={s.btnSmall}>Scegli file</label>
        <input id={inputId} type="file" multiple accept="audio/*,.zip,.wav,.aif,.aiff,.mp3" className={s.srOnly} onChange={e => { add(e.target.files); e.target.value = ""; }} />
        <small><DemoBadge /> Caricamento simulato: i file non lasciano il tuo dispositivo e non vengono salvati.</small>
      </div>
      {items.length > 0 && (
        <ul className={s.fileList} aria-label="File selezionati">
          {items.map(i => (
            <li key={i.id}>
              <FileAudio size={18} aria-hidden="true" />
              <span className={s.fileName}>{i.name}<small>{fmtSize(i.size)} · {i.progress >= 100 ? "pronto (demo)" : "caricamento simulato…"}</small></span>
              <progress max={100} value={Math.round(i.progress)} aria-label={`Avanzamento ${i.name}`} />
              <button type="button" className={s.iconBtn} aria-label={`Rimuovi ${i.name}`} onClick={() => setItems(l => l.filter(x => x.id !== i.id))}><X size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

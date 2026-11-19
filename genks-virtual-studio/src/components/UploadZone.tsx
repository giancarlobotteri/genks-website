import { FileAudio, UploadCloud, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import s from "../styles/vs.module.css";

type Item = { id: string; name: string; size: number };

const fmtSize = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} kB`);

/**
 * The files of the project: the customer lists them here (names and sizes go with the request, so GENKS
 * knows what is coming); the files themselves are sent afterwards, through the transfer link that
 * arrives by email with the confirmation. Nothing is read or uploaded from this page.
 */
export function UploadZone({ onChange }: { onChange: (names: string[]) => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);
  const inputId = useId();

  useEffect(() => { onChange(items.map(i => `${i.name} (${fmtSize(i.size)})`)); }, [items, onChange]);

  const add = (files: FileList | null) => {
    if (!files) return;
    setItems(list => [...list, ...Array.from(files).map(f => ({ id: `${f.name}-${f.size}-${Math.random()}`, name: f.name, size: f.size }))]);
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
        <p><strong>Trascina qui le tracce (stems) o i file audio</strong> oppure</p>
        <label htmlFor={inputId} className={s.btnSmall}>Scegli file</label>
        <input id={inputId} type="file" multiple accept="audio/*,.zip,.wav,.aif,.aiff,.mp3" className={s.srOnly} onChange={e => { add(e.target.files); e.target.value = ""; }} />
        <small>Serve a indicarci cosa ci manderai: i file li carichi dopo, con il link che ricevi via email.</small>
      </div>
      {items.length > 0 && (
        <ul className={s.fileList} aria-label="File indicati">
          {items.map(i => (
            <li key={i.id}>
              <FileAudio size={18} aria-hidden="true" />
              <span className={s.fileName}>{i.name}<small>{fmtSize(i.size)}</small></span>
              <button type="button" className={s.iconBtn} aria-label={`Rimuovi ${i.name}`} onClick={() => setItems(l => l.filter(x => x.id !== i.id))}><X size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

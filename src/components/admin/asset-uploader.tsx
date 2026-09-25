"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, FileArchive, FileAudio, ImageIcon, RefreshCw, Upload, Video } from "lucide-react";
import * as tus from "tus-js-client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const buckets = { cover: "covers", preview: "previews", visual: "covers", mp3: "beat-assets", wav: "beat-assets", stems: "beat-assets" } as const;
type AssetKind = keyof typeof buckets;
type AssetDefinition = { kind: AssetKind; label: string; detail: string; accept: string; icon: typeof FileAudio };
export type ExistingAsset = { kind: string; filename: string };

const publicAssets: AssetDefinition[] = [
  { kind: "cover", label: "Cover", detail: "Public artwork", accept: "image/*", icon: ImageIcon },
  { kind: "preview", label: "Preview", detail: "Optional public tagged MP3", accept: ".mp3,audio/mpeg", icon: FileAudio },
  { kind: "visual", label: "Visual", detail: "Optional image or video", accept: "image/*,video/*", icon: Video },
];
const premiumAssets: AssetDefinition[] = [
  { kind: "mp3", label: "MP3 MASTER", detail: "Private high-quality MP3", accept: ".mp3,audio/mpeg", icon: FileAudio },
  { kind: "wav", label: "WAV MASTER", detail: "Private lossless master", accept: ".wav,audio/wav,audio/x-wav", icon: FileAudio },
  { kind: "stems", label: "STEMS / TRACKOUT", detail: "Private ZIP with separated tracks", accept: ".zip,application/zip,application/x-zip-compressed", icon: FileArchive },
];

async function uploadAsset(beatId: string, kind: AssetKind, file: File, onProgress: (value: number) => void) {
  const bucket = buckets[kind];
  const path = `${beatId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  const supabase = createSupabaseBrowserClient();
  onProgress(0);
  if (file.size > 6 * 1024 * 1024) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Admin session expired.");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_GENKS_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_GENKS_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !publishableKey) throw new Error("Supabase is not configured.");
    await new Promise<void>((resolve, reject) => new tus.Upload(file, {
      endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
      headers: { authorization: `Bearer ${session.access_token}`, apikey: publishableKey },
      metadata: { bucketName: bucket, objectName: path, contentType: file.type || "application/octet-stream", cacheControl: "3600" },
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 1000, 3000, 5000],
      onError: reject,
      onProgress: (sent, total) => onProgress(Math.round(sent / total * 100)),
      onSuccess: () => resolve(),
    }).start());
  } else {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
    if (error) throw error;
    onProgress(100);
  }
  const response = await fetch("/api/admin/assets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ beatId, kind, bucket, path, filename: file.name, size: file.size }) });
  if (!response.ok) throw new Error((await response.json()).error || "Unable to link the uploaded file.");
}

export function BeatCreateForm() {
  const router = useRouter();
  const [files, setFiles] = useState<Partial<Record<AssetKind, File>>>({});
  const [progress, setProgress] = useState<Partial<Record<AssetKind, number>>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [createdBeatId, setCreatedBeatId] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true); setMessage("");
    try {
      const payload = {
        title: values.get("title"), slug: values.get("slug"), bpm: values.get("bpm"), musicalKey: values.get("musicalKey"), genre: values.get("genre"), mood: values.get("mood"),
        tags: values.get("tags"), description: values.get("description"), status: values.get("status"), featured: values.get("featured") === "on", sortOrder: values.get("sortOrder"), publicationDate: values.get("publicationDate"),
      };
      const response = await fetch("/api/admin/beats", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Beat creation failed.");
      setCreatedBeatId(result.id);
      const selected = Object.entries(files) as [AssetKind, File][];
      const outcomes = await Promise.allSettled(
        selected.map(([kind, file]) => uploadAsset(
          result.id,
          kind,
          file,
          (value) => setProgress((current) => ({ ...current, [kind]: value })),
        )),
      );
      const failed = outcomes.filter((item) => item.status === "rejected").length;
      setMessage(failed ? `Beat created, but ${failed} file${failed === 1 ? "" : "s"} failed. Select it again and use Replace now.` : `Beat created successfully${selected.length ? " with all selected files" : ""}.`);
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create the beat."); }
    finally { setBusy(false); }
  }

  async function replaceAfterCreation(kind: AssetKind) {
    const file = files[kind];
    if (!createdBeatId || !file) return;
    setBusy(true); setMessage("");
    try {
      await uploadAsset(createdBeatId, kind, file, (value) => setProgress((current) => ({ ...current, [kind]: value })))
      setMessage(`${file.name} is now the active ${kind.toUpperCase()} file.`); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Replacement failed."); }
    finally { setBusy(false); }
  }

  const choose = (kind: AssetKind, file: File) => setFiles((current) => ({ ...current, [kind]: file }));
  return <form className="beat-create-form" onSubmit={submit}>
    <section className="beat-create-section"><header><div><span className="eyebrow">01 · DETAILS & PUBLISHING</span><h2>New beat</h2></div><small>Details, publishing and files in one place.</small></header>
      <div className="premium-form form-grid beat-details-grid">
        <label>Title<input name="title" required /></label><label>Slug<input name="slug" pattern="[a-z0-9-]+" required /></label><label>BPM<input name="bpm" type="number" min="30" max="300" required /></label><label>Key<input name="musicalKey" required /></label>
        <label>Genre<select name="genre" required>{["TRAP","R&B","AFRO","REGGAE","POP","RAP/HIPHOP","EXPERIMENTAL"].map((genre) => <option key={genre}>{genre}</option>)}</select></label><label>Mood<input name="mood" required /></label>
        <label className="full">Tags<input name="tags" placeholder="dark, melodic, late night" /></label><label>Status<select name="status"><option value="draft">Draft</option><option value="published">Published</option></select></label>
        <label>Display order<input name="sortOrder" type="number" min="0" defaultValue="0" required /></label><label>Publication date<input name="publicationDate" type="date" /></label><label className="checkbox"><input name="featured" type="checkbox" /> Featured</label>
        <label className="full">Description<textarea name="description" rows={4} /></label>
      </div>
    </section>
    <AssetSelectionGroup index="02" title="Public media" subtitle="Visible in the store" assets={publicAssets} files={files} progress={progress} onSelect={choose} createdBeatId={createdBeatId} busy={busy} onReplace={replaceAfterCreation} />
    <AssetSelectionGroup index="03" title="Premium delivery files" subtitle="Private · unlocked only by license entitlement" assets={premiumAssets} files={files} progress={progress} onSelect={choose} createdBeatId={createdBeatId} busy={busy} onReplace={replaceAfterCreation} premium />
    {message ? <p className={`asset-upload-message beat-create-message ${message.includes("successfully") || message.includes("active") ? "success" : ""}`} role="status">{message}</p> : null}
    {!createdBeatId ? <button className="button button-primary beat-create-submit" disabled={busy}><Upload size={18} />{busy ? "CREATING & UPLOADING…" : "CREATE BEAT & UPLOAD FILES"}</button> : <div className="beat-created-state"><Check size={19} /><span>Beat created. You can replace any selected file now or edit it later below.</span></div>}
  </form>;
}

function AssetSelectionGroup({ index, title, subtitle, assets, files, progress, onSelect, createdBeatId, busy, onReplace, premium = false }: { index: string; title: string; subtitle: string; assets: AssetDefinition[]; files: Partial<Record<AssetKind, File>>; progress: Partial<Record<AssetKind, number>>; onSelect: (kind: AssetKind, file: File) => void; createdBeatId: string; busy: boolean; onReplace: (kind: AssetKind) => Promise<void>; premium?: boolean }) {
  return <section className={`asset-group ${premium ? "premium" : ""}`}><header><div><span className="eyebrow">{index} · {premium ? "PROTECTED STORAGE" : "STORE ASSETS"}</span><h3>{title}</h3></div><small>{subtitle}</small></header><div className="asset-upload-grid">{assets.map((asset) => <AssetSelectionCard key={asset.kind} asset={asset} file={files[asset.kind]} progress={progress[asset.kind]} onSelect={onSelect} createdBeatId={createdBeatId} busy={busy} onReplace={onReplace} />)}</div></section>;
}

function AssetSelectionCard({ asset, file, progress, onSelect, createdBeatId, busy, onReplace }: { asset: AssetDefinition; file?: File; progress?: number; onSelect: (kind: AssetKind, file: File) => void; createdBeatId: string; busy: boolean; onReplace: (kind: AssetKind) => Promise<void> }) {
  const Icon = asset.icon;
  return <div className="asset-upload-card"><div className="asset-upload-icon"><Icon size={23} /></div><div><strong>{asset.label}</strong><small>{asset.detail}</small></div><label className="asset-file-control"><input type="file" accept={asset.accept} onChange={(event) => { const selected = event.target.files?.[0]; if (selected) onSelect(asset.kind, selected); }} /><span>{file?.name || "Choose file"}</span></label>{createdBeatId && file ? <button type="button" className="button button-secondary" disabled={busy} onClick={() => onReplace(asset.kind)}><RefreshCw size={15} />REPLACE NOW</button> : null}{progress !== undefined ? <progress max="100" value={progress}>{progress}%</progress> : null}</div>;
}

export function AssetUploader({ beatId, existingAssets }: { beatId: string; existingAssets: ExistingAsset[] }) {
  const router = useRouter();
  const currentFiles = useMemo(() => new Map(existingAssets.map((asset) => [asset.kind, asset.filename])), [existingAssets]);
  const [progress, setProgress] = useState<Partial<Record<AssetKind, number>>>({});
  const [messages, setMessages] = useState<Partial<Record<AssetKind, string>>>({});
  async function upload(kind: AssetKind, file: File) {
    setMessages((current) => ({ ...current, [kind]: "" }));
    try {
      await uploadAsset(beatId, kind, file, (value) => setProgress((current) => ({ ...current, [kind]: value })));
      setMessages((current) => ({ ...current, [kind]: `${file.name} is now active.` }));
      router.refresh();
    }
    catch (error) { setMessages((current) => ({ ...current, [kind]: error instanceof Error ? error.message : "Upload failed." })); }
  }
  return <div className="asset-manager asset-editor"><AssetEditGroup title="Public media" assets={publicAssets} currentFiles={currentFiles} progress={progress} messages={messages} onUpload={upload} /><AssetEditGroup title="Premium delivery files" assets={premiumAssets} currentFiles={currentFiles} progress={progress} messages={messages} onUpload={upload} premium /></div>;
}

function AssetEditGroup({ title, assets, currentFiles, progress, messages, onUpload, premium = false }: { title: string; assets: AssetDefinition[]; currentFiles: Map<string, string>; progress: Partial<Record<AssetKind, number>>; messages: Partial<Record<AssetKind, string>>; onUpload: (kind: AssetKind, file: File) => Promise<void>; premium?: boolean }) {
  return <section className={`asset-group ${premium ? "premium" : ""}`}><header><div><span className="eyebrow">{premium ? "PROTECTED STORAGE" : "STORE ASSETS"}</span><h3>{title}</h3></div><small>Choose a new file only for the item you need to replace.</small></header><div className="asset-upload-grid">{assets.map((asset) => <AssetEditCard key={asset.kind} asset={asset} currentFilename={currentFiles.get(asset.kind)} progress={progress[asset.kind]} message={messages[asset.kind]} onUpload={onUpload} />)}</div></section>;
}

function AssetEditCard({ asset, currentFilename, progress, message, onUpload }: { asset: AssetDefinition; currentFilename?: string; progress?: number; message?: string; onUpload: (kind: AssetKind, file: File) => Promise<void> }) {
  const Icon = asset.icon; const [file, setFile] = useState<File>(); const [busy, setBusy] = useState(false);
  async function replace() { if (!file) return; setBusy(true); await onUpload(asset.kind, file); setBusy(false); }
  return <div className="asset-upload-card"><div className="asset-upload-icon"><Icon size={23} /></div><div><strong>{asset.label}</strong><small className="asset-current-file">{currentFilename ? `Current: ${currentFilename}` : "No file uploaded"}</small></div><label className="asset-file-control"><input type="file" accept={asset.accept} onChange={(event) => setFile(event.target.files?.[0])} /><span>{file?.name || (currentFilename ? "Choose replacement" : "Choose file")}</span></label><button type="button" className="button button-secondary" disabled={!file || busy} onClick={replace}>{currentFilename ? <RefreshCw size={15} /> : <Upload size={15} />}{busy ? "UPLOADING…" : currentFilename ? "REPLACE FILE" : "UPLOAD FILE"}</button>{progress !== undefined ? <progress max="100" value={progress}>{progress}%</progress> : null}{message ? <p className="asset-upload-message" role="status">{message}</p> : null}</div>;
}

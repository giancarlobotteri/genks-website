"use client";

import { useState, type FormEvent } from "react";
import { FileArchive, FileAudio, ImageIcon, Upload, Video } from "lucide-react";
import * as tus from "tus-js-client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const buckets = { cover: "covers", preview: "previews", visual: "covers", mp3: "beat-assets", wav: "beat-assets", stems: "beat-assets" } as const;
type AssetKind = keyof typeof buckets;
type AssetDefinition = { kind: AssetKind; label: string; detail: string; accept: string; icon: typeof FileAudio };

const publicAssets: AssetDefinition[] = [
  { kind: "cover", label: "Cover", detail: "Public artwork", accept: "image/*", icon: ImageIcon },
  { kind: "preview", label: "Preview", detail: "Public tagged MP3", accept: ".mp3,audio/mpeg", icon: FileAudio },
  { kind: "visual", label: "Visual", detail: "Optional image or video", accept: "image/*,video/*", icon: Video },
];

const premiumAssets: AssetDefinition[] = [
  { kind: "mp3", label: "MP3 MASTER", detail: "Private high-quality MP3", accept: ".mp3,audio/mpeg", icon: FileAudio },
  { kind: "wav", label: "WAV MASTER", detail: "Private lossless master", accept: ".wav,audio/wav,audio/x-wav", icon: FileAudio },
  { kind: "stems", label: "STEMS / TRACKOUT", detail: "Private ZIP with separated tracks", accept: ".zip,application/zip,application/x-zip-compressed", icon: FileArchive },
];

export function AssetUploader({ beats }: { beats: { id: string; title: string }[] }) {
  const [beatId, setBeatId] = useState(beats[0]?.id ?? "");
  const [progress, setProgress] = useState<Partial<Record<AssetKind, number>>>({});
  const [messages, setMessages] = useState<Partial<Record<AssetKind, string>>>({});

  async function upload(kind: AssetKind, file: File) {
    if (!file.size || !beatId) return;
    setProgress((current) => ({ ...current, [kind]: 0 }));
    setMessages((current) => ({ ...current, [kind]: "" }));
    const bucket = buckets[kind];
    const path = `${beatId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const supabase = createSupabaseBrowserClient();

    try {
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
          onProgress: (sent, total) => setProgress((current) => ({ ...current, [kind]: Math.round(sent / total * 100) })),
          onSuccess: () => resolve(),
        }).start());
      } else {
        const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
        if (error) throw error;
        setProgress((current) => ({ ...current, [kind]: 100 }));
      }

      const response = await fetch("/api/admin/assets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ beatId, kind, bucket, path, filename: file.name, size: file.size }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      setMessages((current) => ({ ...current, [kind]: `${file.name} uploaded and linked.` }));
    } catch (error) {
      setMessages((current) => ({ ...current, [kind]: error instanceof Error ? error.message : "Upload failed." }));
    }
  }

  return <div className="asset-manager">
    <label className="asset-beat-picker">Selected beat<select value={beatId} onChange={(event) => setBeatId(event.target.value)}>{beats.map((beat) => <option key={beat.id} value={beat.id}>{beat.title}</option>)}</select></label>
    <AssetGroup title="Public media" subtitle="Visible in the store" assets={publicAssets} progress={progress} messages={messages} onUpload={upload} />
    <AssetGroup title="Premium delivery files" subtitle="Private · unlocked only by license entitlement" assets={premiumAssets} progress={progress} messages={messages} onUpload={upload} premium />
  </div>;
}

function AssetGroup({ title, subtitle, assets, progress, messages, onUpload, premium = false }: {
  title: string;
  subtitle: string;
  assets: AssetDefinition[];
  progress: Partial<Record<AssetKind, number>>;
  messages: Partial<Record<AssetKind, string>>;
  onUpload: (kind: AssetKind, file: File) => Promise<void>;
  premium?: boolean;
}) {
  return <section className={`asset-group ${premium ? "premium" : ""}`}>
    <header><div><span className="eyebrow">{premium ? "PROTECTED STORAGE" : "STORE ASSETS"}</span><h3>{title}</h3></div><small>{subtitle}</small></header>
    <div className="asset-upload-grid">{assets.map((asset) => <AssetCard key={asset.kind} asset={asset} progress={progress[asset.kind]} message={messages[asset.kind]} onUpload={onUpload} />)}</div>
  </section>;
}

function AssetCard({ asset, progress, message, onUpload }: {
  asset: AssetDefinition;
  progress?: number;
  message?: string;
  onUpload: (kind: AssetKind, file: File) => Promise<void>;
}) {
  const Icon = asset.icon;
  const [filename, setFilename] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get("file") as File;
    if (!file?.size) return;
    setBusy(true);
    await onUpload(asset.kind, file);
    setBusy(false);
  }
  return <form className="asset-upload-card" onSubmit={submit}>
    <div className="asset-upload-icon"><Icon size={23} /></div>
    <div><strong>{asset.label}</strong><small>{asset.detail}</small></div>
    <label className="asset-file-control"><input name="file" type="file" accept={asset.accept} required onChange={(event) => setFilename(event.target.files?.[0]?.name ?? "")} /><span>{filename || "Choose file"}</span></label>
    <button className="button button-secondary" disabled={busy}><Upload size={16} />{busy ? "UPLOADING…" : "UPLOAD"}</button>
    {progress !== undefined ? <progress max="100" value={progress}>{progress}%</progress> : null}
    {message ? <p className="asset-upload-message" role="status">{message}</p> : null}
  </form>;
}

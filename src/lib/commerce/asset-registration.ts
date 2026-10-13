import { z } from "zod";

const buckets = { cover: "covers", preview: "previews", visual: "covers", mp3: "beat-assets", wav: "beat-assets", stems: "beat-assets" } as const;

export const assetRegistrationSchema = z.object({
  beatId: z.uuid(),
  kind: z.enum(["cover", "preview", "visual", "mp3", "wav", "stems"]),
  bucket: z.enum(["covers", "previews", "beat-assets"]),
  path: z.string().min(3).max(1000),
  filename: z.string().min(1).max(255),
  size: z.number().int().nonnegative(),
}).superRefine((asset, context) => {
  if (asset.bucket !== buckets[asset.kind]) context.addIssue({ code: "custom", path: ["bucket"], message: "I file completi devono essere nell’archivio privato. Copertine e anteprime devono usare i rispettivi archivi." });
  const segments = asset.path.split("/");
  if (segments[0] !== asset.beatId || segments.length < 2 || segments.some(part => !part || part === "." || part === "..")) context.addIssue({ code: "custom", path: ["path"], message: "Il file deve appartenere alla cartella del beat selezionato." });
});

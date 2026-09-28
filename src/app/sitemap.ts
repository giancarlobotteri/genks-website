export const dynamic = "force-static";
import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/config/site";
import { privatePreview } from "@/lib/preview-mode";

export default function sitemap(): MetadataRoute.Sitemap {
  if (privatePreview) return [];
  const origin = getSiteOrigin();
  return origin
    ? ["/", "/beats"].map((path) => ({ url: new URL(path, origin).href }))
    : [];
}

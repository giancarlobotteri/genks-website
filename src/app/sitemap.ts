export const dynamic = "force-static";
import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = getSiteOrigin();
  return origin
    ? ["/", "/beats"].map((path) => ({ url: new URL(path, origin).href }))
    : [];
}

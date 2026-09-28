export const dynamic = "force-static";
import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/config/site";
import { privatePreview } from "@/lib/preview-mode";

export default function robots(): MetadataRoute.Robots {
  if (privatePreview) return { rules: { userAgent: "*", disallow: "/" } };
  const origin = getSiteOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/account", "/admin", "/api"],
    },
    ...(origin ? { sitemap: new URL("/sitemap.xml", origin).href } : {}),
  };
}

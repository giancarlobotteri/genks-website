export const dynamic = "force-static";
import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
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

import { BEATS_ENABLED } from "@/config/features";
export const dynamic = "force-dynamic";
import type { MetadataRoute } from "next";
import { getSiteOrigin } from "@/config/site";
import { privatePreview } from "@/lib/preview-mode";
import { beatRepository } from "@/lib/repositories/beats";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (privatePreview) return [];
  const origin = getSiteOrigin();
  if (!origin) return [];
  const beats = BEATS_ENABLED ? await beatRepository.listPublished() : [];
  return ["/", "/chi-sono", "/lavori", "/guida/tracce", ...(BEATS_ENABLED ? ["/beats"] : []), "/services", "/services/recording", "/services/project", "/services/custom", "/services/regole", "/guida", ...beats.filter(beat=>beat.readyLicenseIds?.length).map(beat=>`/beats/${beat.slug}`)].map(path => ({ url: new URL(path, origin).href }));
}

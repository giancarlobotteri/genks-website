import type { Beat, License } from "@/types/domain";

/** Availability shown in the catalogue is preflight; checkout revalidates files. */
export function canBuyLicense(beat: Beat, license: License) {
  return !beat.isDemo && !license.isDemo && Boolean(beat.previewUrl) &&
    !license.isExclusive && license.id !== "exclusive" && beat.licenseIds.includes(license.id) &&
    Boolean(beat.readyLicenseIds?.includes(license.id)) && Boolean(license.contractText?.trim()) &&
    !/bozza da completare/i.test(license.contractText ?? "");
}

export function canBuyBeat(beat: Beat, licenses: License[]) {
  return licenses.some(license => canBuyLicense(beat, license));
}

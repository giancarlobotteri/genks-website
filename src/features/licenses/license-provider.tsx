"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ArrowUpRight, Check } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { formatPrice } from "@/lib/format";
import { site } from "@/config/site";
import type { Beat, License } from "@/types/domain";

const LicenseContext = createContext<{
  openLicenses: (beat: Beat) => void;
  licenses: License[];
} | null>(null);

export function LicenseProvider({
  children,
  licenses,
}: {
  children: ReactNode;
  licenses: License[];
}) {
  const [beat, setBeat] = useState<Beat | null>(null);
  const headingId = useId();
  const openLicenses = useCallback((selected: Beat) => setBeat(selected), []);
  const context = useMemo(
    () => ({ openLicenses, licenses }),
    [openLicenses, licenses],
  );

  return (
    <LicenseContext value={context}>
      {children}
      <Modal open={!!beat} onClose={() => setBeat(null)} titleId={headingId}>
        <span className="eyebrow">CHOOSE YOUR LICENSE</span>
        <h2 id={headingId}>{beat?.title ?? "Licenses"}</h2>
        <p className="muted">Find the format for your next track.</p>
        <div className="license-options">
          {licenses
            .filter((license) => beat?.licenseIds.includes(license.id))
            .map((license) => (
              <section className="license-option" key={license.id}>
                <div>
                  <h3>{license.name}</h3>
                  <span className="mono muted">{license.format}</span>
                </div>
                <strong>{formatPrice(license.priceCents)}</strong>
                <ul>
                  {license.features.map((feature) => (
                    <li key={feature}>
                      <Check size={15} aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {beat && !license.isDemo && license.id !== "exclusive" && (
                  <a className="button button-primary" href={`/checkout/${beat.id}/${license.id}`}>BUY {license.name.toUpperCase()} <ArrowUpRight size={16} /></a>
                )}
                {beat && license.id === "exclusive" && (
                  <a className="button button-secondary" href={`/services/exclusive?beat=${encodeURIComponent(beat.id)}`}>REQUEST EXCLUSIVE <ArrowUpRight size={16} /></a>
                )}
              </section>
            ))}
        </div>
        {beat?.isDemo && <p className="demo-note">Demo catalog and example prices. Add real beats in Admin after connecting Supabase.</p>}
        <a
          className="button button-primary"
          href={site.instagram}
          target="_blank"
          rel="noreferrer"
        >
          Talk to GENKS <ArrowUpRight size={18} aria-hidden="true" />
        </a>
      </Modal>
    </LicenseContext>
  );
}

export function useLicenses() {
  const value = useContext(LicenseContext);
  if (!value) throw new Error("LicenseProvider is required");
  return value;
}

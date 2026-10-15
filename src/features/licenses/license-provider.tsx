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
        <span className="eyebrow">SCEGLI LA TUA LICENZA</span>
        <h2 id={headingId}>{beat?.title ?? "Licenze"}</h2>
        <p className="muted">Confronta file e condizioni prima di acquistare. Ogni licenza si applica a questo beat.</p>
        <div className="license-options">
          {licenses
            .filter((license) => beat?.licenseIds.includes(license.id))
            .map((license) => (
              <section className="license-option" key={license.id}>
                <div>
                  <h3>{license.name}</h3>
                  <span className="mono muted">{license.format}</span>
                </div>
                <strong>
                  {formatPrice(beat?.licensePrices?.[license.id] ?? license.priceCents)}
                </strong>
                <ul>
                  {license.features.map((feature) => (
                    <li key={feature}>
                      <Check size={15} aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {beat && !license.isDemo && !license.isExclusive && license.id !== "exclusive" && (
                  <a className="button button-primary" href={`/checkout/${beat.id}/${license.id}`}>ACQUISTA {license.name.toUpperCase()} <ArrowUpRight size={16} /></a>
                )}
                {beat && (license.isExclusive || license.id === "exclusive") && (
                  <a className="button button-secondary" href={`/services/exclusive?beat=${encodeURIComponent(beat.id)}`}>RICHIEDI L’ESCLUSIVA <ArrowUpRight size={16} /></a>
                )}
              </section>
            ))}
        </div>
        {beat?.isDemo && <p className="demo-note">Catalogo dimostrativo e prezzi di esempio. Aggiungi i beat reali dal pannello amministratore dopo aver collegato Supabase.</p>}
        <a
          className="text-link"
          href={site.instagram}
          target="_blank"
          rel="noreferrer"
        >
          Hai domande su una licenza? <ArrowUpRight size={18} aria-hidden="true" />
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

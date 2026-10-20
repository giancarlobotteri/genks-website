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
import Link from "next/link";
import { studioCashOnly, studioBeatHref } from "@/lib/studio-payment-mode";
import { canBuyLicense } from "@/lib/catalog-availability";
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
                  {studioCashOnly ? "Preventivo in studio" : formatPrice(beat?.licensePrices?.[license.id] ?? license.priceCents)}
                </strong>
                <ul>
                  {license.features.map((feature) => (
                    <li key={feature}>
                      <Check size={15} aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {license.contractText && !/bozza da completare/i.test(license.contractText) && <details className="license-terms-preview"><summary>Leggi le condizioni di questa licenza</summary><p className="license-contract-copy">{license.contractText}</p></details>}
                {!studioCashOnly && beat && canBuyLicense(beat, license) && (
                  <a className="button button-primary" href={`/checkout/${beat.id}/${license.id}`}>ACQUISTA {license.name.toUpperCase()} <ArrowUpRight size={16} /></a>
                )}
                {!studioCashOnly && beat && !license.isExclusive && license.id !== "exclusive" && !canBuyLicense(beat, license) && <p className="license-unavailable">In preparazione · acquisto non ancora disponibile.</p>}
                {beat && (license.isExclusive || license.id === "exclusive") && (
                  <a className="button button-secondary" href={`/services/exclusive?beat=${encodeURIComponent(beat.id)}`}>RICHIEDI L’ESCLUSIVA <ArrowUpRight size={16} /></a>
                )}
              </section>
            ))}
        </div>
        {studioCashOnly && beat && <Link className="button button-primary" href={studioBeatHref(beat)}>Richiedi questo beat in studio</Link>}
        {!studioCashOnly && beat?.isDemo && <p className="demo-note">Anteprima del catalogo: questo beat non è in vendita.</p>}
        <Link
          className="text-link"
          href="/guida#licenze"
        >
          Quale licenza fa per te? <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </Modal>
    </LicenseContext>
  );
}

export function useLicenses() {
  const value = useContext(LicenseContext);
  if (!value) throw new Error("LicenseProvider is required");
  return value;
}

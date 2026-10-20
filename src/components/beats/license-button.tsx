"use client";

import { ArrowUpRight } from "lucide-react";
import { useLicenses } from "@/features/licenses/license-provider";
import { formatPrice } from "@/lib/format";
import type { Beat } from "@/types/domain";
import Link from "next/link";
import { studioCashOnly, studioBeatHref } from "@/lib/studio-payment-mode";
import { canBuyBeat } from "@/lib/catalog-availability";

export function LicenseButton({
  beat,
  compact = false,
}: {
  beat: Beat;
  compact?: boolean;
}) {
  const { licenses, openLicenses } = useLicenses();
  const ready = canBuyBeat(beat, licenses);
  const available = licenses.filter(
    (license) =>
      beat.licenseIds.includes(license.id) && !license.isExclusive && license.id !== "exclusive",
  );
  const price = available.length
    ? Math.min(...available.map((license) => beat.licensePrices?.[license.id] ?? license.priceCents))
    : null;
  if (studioCashOnly) return <Link className={compact ? "license-button" : "button button-secondary"} href={studioBeatHref(beat)}>Richiedi in studio <ArrowUpRight size={15} aria-hidden="true" /></Link>;
  return (
    <button
      type="button"
      className={compact ? "license-button" : "button button-secondary"}
      aria-label={`${ready ? "Acquista" : "Vedi le licenze di"} ${beat.title}${ready ? ": scegli la licenza" : ""}`}
      onClick={() => openLicenses(beat)}
    >
      {compact && price !== null ? (
        <>
          <span>{ready ? "Acquista" : "Vedi licenze"} <small>da {formatPrice(price)}</small></span> <ArrowUpRight size={15} aria-hidden="true" />
        </>
      ) : (
        <>
          Opzioni di licenza <ArrowUpRight size={17} />
        </>
      )}
    </button>
  );
}

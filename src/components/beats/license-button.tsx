"use client";

import { ArrowUpRight } from "lucide-react";
import { useLicenses } from "@/features/licenses/license-provider";
import { formatPrice } from "@/lib/format";
import type { Beat } from "@/types/domain";

export function LicenseButton({
  beat,
  compact = false,
}: {
  beat: Beat;
  compact?: boolean;
}) {
  const { licenses, openLicenses } = useLicenses();
  const available = licenses.filter(
    (license) =>
      beat.licenseIds.includes(license.id) && !license.isExclusive && license.id !== "exclusive",
  );
  const price = available.length
    ? Math.min(...available.map((license) => beat.licensePrices?.[license.id] ?? license.priceCents))
    : null;
  return (
    <button
      type="button"
      className={compact ? "license-button" : "button button-secondary"}
      aria-label={`Acquista ${beat.title}: scegli la licenza`}
      onClick={() => openLicenses(beat)}
    >
      {compact && price !== null ? (
        <>
          <span>Acquista <small>da {formatPrice(price)}</small></span> <ArrowUpRight size={15} aria-hidden="true" />
        </>
      ) : (
        <>
          Opzioni di licenza <ArrowUpRight size={17} />
        </>
      )}
    </button>
  );
}

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
      beat.licenseIds.includes(license.id) && license.id !== "exclusive",
  );
  const price = available.length
    ? Math.min(...available.map((license) => license.priceCents))
    : null;
  return (
    <button
      type="button"
      className={compact ? "license-button" : "button button-secondary"}
      aria-label={`Visualizza le licenze di ${beat.title}`}
      onClick={() => openLicenses(beat)}
    >
      {compact && price !== null ? (
        <>
          {formatPrice(price)} <ArrowUpRight size={15} />
        </>
      ) : (
        <>
          Opzioni di licenza <ArrowUpRight size={17} />
        </>
      )}
    </button>
  );
}

import { extraTimeCents } from './extra-time.ts';
import { fromRomeWallTime } from './rome-time.ts';
import { durationLabel } from './studio-scheduler.ts';
import { serviceAmount } from './service-rates.ts';

export type SavedOrderItem = { name: string; amount?: string };
export type SavedOrderPart = { title: string; hours?: string; items: SavedOrderItem[] };

// These two package formats originally stored the night charge inside the studio line.
function bundledNightCharge(selection: { packageCode?: string; date?: string; time?: string } | undefined, hours: number | undefined) {
  if (!selection?.packageCode || !['voice', 'turnkey', 'beat_voice'].includes(selection.packageCode)
    || !selection.date || !selection.time || !hours || hours <= 0) return 0;
  try {
    const start = fromRomeWallTime(selection.date, selection.time);
    const next = new Date(`${selection.date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const midnight = fromRomeWallTime(next.toISOString().slice(0, 10), '00:00');
    return extraTimeCents(0, Math.max(0, (start.getTime() + hours * 3_600_000 - midnight.getTime()) / 60_000), 0);
  } catch {
    return 0;
  }
}

export function savedOrderDetails(snapshot: unknown): SavedOrderPart[] {
  if (!snapshot || typeof snapshot !== 'object') return [];
  const data = snapshot as {
    parts?: { title?: string; hours?: number; selection?: Parameters<typeof bundledNightCharge>[0]; lines?: { name?: string; amount?: number }[] }[];
    preventivo?: { righe?: { descrizione?: string; prezzo?: string }[] };
  };
  const parts = Array.isArray(data.parts) ? data.parts : [];
  const details = parts.flatMap(part => {
    if (typeof part?.title !== 'string' || !part.title.trim()) return [];
    const items = (Array.isArray(part.lines) ? part.lines : []).flatMap(line => {
      if (typeof line?.name !== 'string' || !line.name.trim() || typeof line.amount !== 'number' || !Number.isSafeInteger(line.amount)) return [];
      const name = line.name.trim();
      if (name.startsWith('Registrazione ·') && name.endsWith(' con supplemento notturno')) {
        const night = bundledNightCharge(part.selection, part.hours);
        if (Number.isSafeInteger(night) && night > 0 && night <= line.amount) {
          return [
            { name: name.replace(/ con supplemento notturno$/, ''), amount: serviceAmount(line.amount - night) },
            { name: 'Supplemento notturno', amount: serviceAmount(night) },
          ];
        }
      }
      return [{ name, amount: serviceAmount(line.amount) }];
    });
    const hours = typeof part.hours === 'number' && Number.isFinite(part.hours) && part.hours > 0
      ? durationLabel(part.hours) : undefined;
    return [{ title: part.title.trim(), hours, items }];
  });
  if (details.some(part => part.items.length)) return details;

  const quote = Array.isArray(data.preventivo?.righe) ? data.preventivo.righe : [];
  const items = quote.flatMap(line => typeof line?.descrizione === 'string' && line.descrizione.trim()
    ? [{ name: line.descrizione.trim(), amount: typeof line.prezzo === 'string' ? line.prezzo : undefined }]
    : []);
  return items.length ? [{ title: 'Preventivo personalizzato', items }] : details;
}

import type { OrderPart, OrderQuote } from './service-order-v8.ts';

export const studioAppointmentPaymentPolicy = 'studio-appointment-fixed20-v1';
export const studioAppointmentPaymentNotice = 'Per ogni sessione in studio prenotata, anche inclusa in un pacchetto, servono 20 € di acconto (minimo per prenotare: 20,00 €), da versare entro metà del tempo tra richiesta e inizio della sessione. Senza acconto si libera solo l’orario e la quota studio non resta da pagare. Gli altri servizi (beat, mix, master, extra) con carta si pagano per intero subito; in contanti si pagano a fine lavoro.';

export function withStudioDepositAndFinalBalance<T extends OrderQuote>(quote: T): T {
  const parts: OrderPart[] = quote.parts.map(part => {
    const scheduled = part.selection.kind === 'production' && part.selection.appointments?.length
      ? part.selection.appointments.filter(appointment => appointment.date && appointment.time).length
      : part.hours > 0 && part.selection.date && part.selection.time ? 1 : 0;
    const deposit = 2000 * scheduled;
    const total = Math.max(part.total, deposit);
    const adjustment = total - part.total;
    // Studio: 20 € per sessione. Altri servizi: con carta subito per intero, in contanti a fine lavoro.
    const studioPortion = scheduled ? Math.min(total, part.studioAmount + adjustment) : 0;
    const otherServices = Math.max(0, total - studioPortion);
    const dueNow = part.selection.payment === 'card' ? Math.min(total, deposit + otherServices) : deposit;
    return {
      ...part,
      total,
      lines: adjustment ? [...part.lines, { name: 'Minimo prenotazione studio', amount: adjustment }] : part.lines,
      studioAmount: part.studioAmount + adjustment,
      bookingAmount: part.bookingAmount === undefined ? undefined : part.bookingAmount + adjustment,
      saving: Math.max(0, part.listTotal - total),
      deposit: dueNow,
      dueNow,
      balance: total - dueNow,
      cardNow: part.selection.payment === 'card' ? dueNow : 0,
      cashNow: part.selection.payment === 'cash' ? dueNow : 0,
      ...(scheduled ? { bookingDeposit: 2000 } : {}),
    };
  });
  return {
    ...quote,
    paymentPolicy: studioAppointmentPaymentPolicy,
    parts,
    total: parts.reduce((sum, part) => sum + part.total, 0),
    saving: parts.reduce((sum, part) => sum + part.saving, 0),
    cardNow: parts.reduce((sum, part) => sum + part.cardNow, 0),
    cashNow: parts.reduce((sum, part) => sum + part.cashNow, 0),
    balance: parts.reduce((sum, part) => sum + part.balance, 0),
  };
}

import type { OrderPart, OrderQuote } from './service-order-v8.ts';

export const studioAppointmentPaymentPolicy = 'studio-appointment-fixed20-v1';
export const studioAppointmentPaymentNotice = 'Per ogni sessione di registrazione prenotata, anche inclusa in un pacchetto, l’acconto è di 20,00 €. Il minimo per prenotare è 20,00 €. Va versato entro metà del tempo tra richiesta e inizio della sessione. Senza acconto si libera solo l’orario e la quota studio non resta da pagare. Gli altri servizi restano confermati e si pagano a fine lavoro.';

export function withStudioDepositAndFinalBalance<T extends OrderQuote>(quote: T): T {
  const parts: OrderPart[] = quote.parts.map(part => {
    const scheduled = part.selection.kind === 'production' && part.selection.appointments?.length
      ? part.selection.appointments.filter(appointment => appointment.date && appointment.time).length
      : part.hours > 0 && part.selection.date && part.selection.time ? 1 : 0;
    const deposit = 2000 * scheduled;
    const total = Math.max(part.total, deposit);
    const adjustment = total - part.total;
    return {
      ...part,
      total,
      lines: adjustment ? [...part.lines, { name: 'Minimo prenotazione studio', amount: adjustment }] : part.lines,
      studioAmount: part.studioAmount + adjustment,
      bookingAmount: part.bookingAmount === undefined ? undefined : part.bookingAmount + adjustment,
      saving: Math.max(0, part.listTotal - total),
      deposit,
      dueNow: deposit,
      balance: total - deposit,
      cardNow: part.selection.payment === 'card' ? deposit : 0,
      cashNow: part.selection.payment === 'cash' ? deposit : 0,
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

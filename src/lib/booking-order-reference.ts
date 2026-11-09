type Related<T> = T | T[] | null | undefined;
type OrderPart = { service_projects?: Related<{ reference?: string }> };
type BookingOrder = {
  service_order_parts_v8?: Related<OrderPart>;
  service_credit_bookings_v8?: Related<{ service_order_parts_v8?: Related<OrderPart> }>;
};

function first<T>(value: Related<T>): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

export function bookingOrderReference(booking: BookingOrder): string | undefined {
  const direct = first(booking.service_order_parts_v8);
  const credit = first(first(booking.service_credit_bookings_v8)?.service_order_parts_v8);
  return first(direct?.service_projects)?.reference ?? first(credit?.service_projects)?.reference;
}

export function isStandaloneStudio(snapshot: unknown): boolean {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const part = snapshot as { standaloneRecording?: boolean; selection?: { kind?: string } };
  return part.standaloneRecording === true || part.selection?.kind === 'recording';
}

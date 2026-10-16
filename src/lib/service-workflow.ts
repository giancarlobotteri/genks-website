const booking: Record<string, string[]> = {
  pending: ["cancelled", "rejected"], approved_awaiting_payment: ["cancelled", "rejected"],
  confirmed: ["completed", "cancelled", "no_show"], completed: [], cancelled: ["pending"], rejected: ["pending"], no_show: [],
};
const project: Record<string, string[]> = {
  requested: ["quoted", "cancelled"], quoted: ["requested", "cancelled"], awaiting_payment: ["quoted", "cancelled"],
  paid: ["in_progress", "cancelled"], in_progress: ["review", "cancelled"], review: ["in_progress", "delivered", "cancelled"],
  delivered: [], cancelled: ["requested"],
};
export function canChangeServiceStatus(type: "booking" | "project", from: string, to: string) {
  return from === to || Boolean((type === "booking" ? booking : project)[from]?.includes(to));
}

export type EconomicsInput = { price: number; discountPercent: number; feePercent: number; feeFixed: number; variableCosts: number; hours: number; hourlyValue: number; monthlyCosts: number };
export function unitEconomics(input: EconomicsInput) {
  if (Object.values(input).some(value => !Number.isFinite(value) || value < 0) || input.discountPercent > 100 || input.feePercent > 100) return null;
  const charged = Math.round(input.price * (1 - input.discountPercent / 100));
  const fees = Math.round(charged * input.feePercent / 100) + input.feeFixed;
  const work = Math.round(input.hours * input.hourlyValue);
  const contribution = charged - fees - input.variableCosts - work;
  return { charged, fees, work, contribution, marginPercent: charged > 0 ? contribution / charged * 100 : null, breakEven: contribution > 0 ? Math.ceil(input.monthlyCosts / contribution) : null };
}

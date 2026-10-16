export type SaleKind = "beat" | "recording" | "mix" | "master" | "mix_master";
export type BusinessSale = {
  id: string; reference: string; customer: string; email: string; kind: SaleKind;
  amount: number; refunded: number; fee: number | null; currency: string; paidAt: string;
  live: boolean; review: string | null; disputed: boolean; providerId: string; targetUrl: string;
  items: string[];
};
export type RefundMovement = { payment_id: string; amount_cents: number; occurred_at: string };
export type BusinessCost = { id: string; description: string; amount_cents: number; incurred_on: string; category: string };
const formatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" });
export const businessDay = (value: string | Date) => formatter.format(new Date(value));
export const kindLabels: Record<SaleKind,string> = { beat: "Beat", recording: "Studio", mix: "Mix", master: "Master", mix_master: "Mix & Master" };

export function businessSummary(sales: BusinessSale[], refunds: RefundMovement[], costs: BusinessCost[], now = new Date()) {
  const today = businessDay(now);
  const week = new Date(`${today}T12:00:00Z`); week.setUTCDate(week.getUTCDate()-(week.getUTCDay()+6)%7);
  const weekStart = week.toISOString().slice(0,10);
  const previous = new Date(`${today.slice(0,7)}-15T12:00:00Z`);previous.setUTCMonth(previous.getUTCMonth()-1);
  const selected = sales.filter(s=>s.currency.toUpperCase()==="EUR");
  const ids = new Set(selected.map(s=>s.id));
  const adjustments = refunds.filter(r=>ids.has(r.payment_id));
  const period = (matches:(day:string)=>boolean) => {
    const rows=selected.filter(s=>matches(businessDay(s.paidAt)));
    const gross=rows.reduce((sum,s)=>sum+s.amount,0);
    const refunded=adjustments.filter(r=>matches(businessDay(r.occurred_at))).reduce((sum,r)=>sum+r.amount_cents,0);
    const fees=rows.reduce((sum,s)=>sum+(s.fee??0),0);
    const expense=costs.filter(c=>matches(c.incurred_on)).reduce((sum,c)=>sum+c.amount_cents,0);
    return {gross,refunded,fees,costs:expense,net:gross-refunded,balance:gross-refunded-fees-expense,count:rows.length,missingFees:rows.filter(r=>r.fee===null).length};
  };
  const days=Array.from({length:30},(_,i)=>{const date=new Date(`${today}T12:00:00Z`);date.setUTCDate(date.getUTCDate()-29+i);const day=date.toISOString().slice(0,10);return {day,...period(d=>d===day)};});
  return {
    lifetime:period(()=>true),today:period(d=>d===today),week:period(d=>d>=weekStart&&d<=today),
    month:period(d=>d.slice(0,7)===today.slice(0,7)),previousMonth:period(d=>d.slice(0,7)===previous.toISOString().slice(0,7)),days,
    customers:new Set(selected.map(s=>s.email.toLowerCase())).size,
    disputed:selected.filter(s=>s.disputed).reduce((n,s)=>n+s.amount-s.refunded,0),
    categories:Object.entries(kindLabels).map(([kind,label])=>({kind,label,total:selected.filter(s=>s.kind===kind).reduce((n,s)=>n+s.amount-s.refunded,0)})),
  };
}

export function filterBusinessSales(sales: BusinessSale[], filters:{day?:string;kind?:string;status?:string}) {
  return sales.filter(s=>(!filters.day||businessDay(s.paidAt)===filters.day)&&(!filters.kind||s.kind===filters.kind)&&(
    !filters.status||filters.status==="paid"&&s.refunded===0&&!s.disputed&&!s.review||filters.status==="refunded"&&s.refunded===s.amount||filters.status==="partial"&&s.refunded>0&&s.refunded<s.amount||filters.status==="review"&&Boolean(s.review||s.disputed)
  ));
}

export function salesCsv(sales:BusinessSale[]) {
  const cell=(value:unknown)=>{let text=String(value??"");if(/^[\s]*[=+@-]/.test(text))text=`'${text}`;return `"${text.replaceAll('"','""')}"`;};
  const rows=[['Riferimento','Data pagamento','Cliente','Email','Tipo','Importo EUR','Rimborsi EUR','Commissioni EUR','Dopo rimborsi EUR','Ambiente','Pagamento Stripe','Da verificare'],
    ...sales.map(s=>[s.reference,new Date(s.paidAt).toISOString(),s.customer,s.email,kindLabels[s.kind],(s.amount/100).toFixed(2),(s.refunded/100).toFixed(2),s.fee===null?'Non disponibile':(s.fee/100).toFixed(2),((s.amount-s.refunded)/100).toFixed(2),s.live?'Reale':'Prova',s.providerId,s.review??(s.disputed?'Contestato':'')])];
  return '\uFEFF'+rows.map(row=>row.map(cell).join(';')).join('\r\n');
}

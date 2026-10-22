export type PublicDiscount = {target:string;label:string;kind:"percent"|"fixed";amount:number;active:boolean};
export function publicDiscounts(value:unknown): PublicDiscount[] {
 const rules=(value as {rules?:unknown})?.rules;
 return Array.isArray(rules)?rules.filter((r):r is PublicDiscount=>Boolean(r&&typeof r.target==="string"&&typeof r.label==="string"&&["percent","fixed"].includes(r.kind)&&Number.isInteger(r.amount)&&r.amount>0&&(r.kind!=="percent"||r.amount<=99)&&typeof r.active==="boolean")):[];
}
export function discountPrice(base:number,targets:string[],rules:PublicDiscount[]=[]) {
 const matching=rules.filter(r=>r.active&&(r.target==="all"||targets.includes(r.target))).sort((a,b)=>(a.target==="all"?999:targets.indexOf(a.target))-(b.target==="all"?999:targets.indexOf(b.target)));
 const rule=matching[0];
 if(!rule||base<=0)return base;
 return Math.max(50,Math.min(base,rule.kind==="percent"?Math.floor(base*(100-rule.amount)/100+.5):base-rule.amount));
}

import { businessDay } from "./business-sales.ts";
export function validBusinessDate(value?: string): value is string {
  return Boolean(value&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T12:00:00Z`))&&new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value);
}
export function salesPeriod(query:{period?:string;anchor?:string;from?:string;to?:string},now=new Date()) {
  const anchor=validBusinessDate(query.anchor)?query.anchor:businessDay(now);
  const type=["day","week","month","year","range"].includes(query.period??"")?query.period!:"month";
  const date=new Date(`${anchor}T12:00:00Z`);
  let from=anchor,to=anchor;
  if(type==="week"){date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);from=date.toISOString().slice(0,10);date.setUTCDate(date.getUTCDate()+6);to=date.toISOString().slice(0,10);}
  if(type==="month"){from=`${anchor.slice(0,7)}-01`;date.setUTCMonth(date.getUTCMonth()+1,0);to=date.toISOString().slice(0,10);}
  if(type==="year"){from=`${anchor.slice(0,4)}-01-01`;to=`${anchor.slice(0,4)}-12-31`;}
  if(type==="range"){from=validBusinessDate(query.from)?query.from:anchor;to=validBusinessDate(query.to)&&query.to>=from?query.to:from;}
  return {type,anchor,from,to};
}


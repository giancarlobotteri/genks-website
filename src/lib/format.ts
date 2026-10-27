export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}

const euroWhole=new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR",maximumFractionDigits:0});
const euroCents=new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR",maximumFractionDigits:2});
export function formatPrice(cents:number):string{return (cents%100?euroCents:euroWhole).format(cents/100);}

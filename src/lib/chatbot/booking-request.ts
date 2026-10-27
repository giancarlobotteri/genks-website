import {shiftDay} from '../booking-slots.ts';
const names=['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
const numbers:Record<string,number>={un:1,una:1,uno:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8};
export function hasRequestedDay(text:string){return /luned|marted|mercoled|gioved|venerd|sabato|domenica|\boggi\b|\bdomani\b|\b20\d{2}-\d{2}-\d{2}\b|\b\d{1,2}\s+(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)/i.test(text);}
export function recordingHoursOnly(text:string):number|null{
 if(hasRequestedDay(text)||/mix|master|beat|\bep\b|\d+[.,]\d+\s*(?:ore|ora|h)/i.test(text)||!/registr|studio/i.test(text))return null;
 const match=text.toLowerCase().match(/\b(\d+|un[oa]?|due|tre|quattro|cinque|sei|sette|otto)\s*(?:ore|ora|h)\b/);
 const hours=match?(numbers[match[1]]??Number(match[1])):0;
 return hours>0&&hours<=200?hours:null;
}
export function parseBookingRequest(text:string,now=new Date()){
 const t=text.toLowerCase();const weekday=names.findIndex(n=>t.includes(n)||t.includes(n.replace('ì','i')));
 const iso=t.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
 let date=iso;
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 if(!date&&weekday>=0){let offset=(weekday-new Date(today+'T12:00:00Z').getUTCDay()+7)%7;if(!offset&&/prossim/.test(t))offset=7;date=shiftDay(today,offset);}
 if(!date&&/\bdomani\b/.test(t))date=shiftDay(today,1);
 if(!date&&/\boggi\b/.test(t))date=today;
 if(!date)return null;
 const duration=t.match(/\b(\d+|un[oa]?|due|tre|quattro|cinque|sei|sette|otto)\s*(?:ore|ora|h)\b/);
 const start=t.match(/\ball[ea]\s+(\d{1,2})(?:[:.](\d{2}))?/);
 if(!duration&&!start&&!/prenot|registr|liber|disponib|studio/.test(t))return null;
 const ore=duration?(numbers[duration[1]]??Number(duration[1])):start?1:null;
 if(!ore||!Number.isInteger(ore)||ore<1||ore>8)return null;
 let ora=start?`${start[1].padStart(2,'0')}:${start[2]??'00'}`:undefined;
 if(!ora&&duration&&/fino.*(?:all[’']?una|all[’']?1\b|01[:.]00)/.test(t))ora=`${String((25-ore)%24).padStart(2,'0')}:00`;
 return {data:date,ore,...ora?{ora}:{}};
}

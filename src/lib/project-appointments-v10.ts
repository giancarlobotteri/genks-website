import {fromRomeWallTime} from './rome-time.ts';
export type ProjectAppointmentV10={date:string;time:string;extraHours:number};
/** Each song has its own two-hour appointment; extensions must be bought beforehand. */
export function validateProjectAppointmentsV10(appointments:ProjectAppointmentV10[],songCount:number,now=new Date()){
  if(!Number.isInteger(songCount)||songCount<2||songCount>20||!Array.isArray(appointments)||appointments.length!==songCount)throw Error('Scegli un appuntamento per ogni brano.');
  const sessions=appointments.map((a,index)=>{
    if(!a||!/^\d{4}-\d{2}-\d{2}$/.test(a.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(a.time)||!Number.isInteger(a.extraHours)||a.extraHours<0||a.extraHours>6)throw Error('Controlla giorno, ora e durata di ogni sessione.');
    const start=fromRomeWallTime(a.date,a.time);
    if(!Number.isFinite(start.getTime())||start.getTime()<=now.getTime()+35*60000)throw Error('Scegli un appuntamento futuro con anticipo sufficiente.');
    const hours=2+a.extraHours,end=new Date(start.getTime()+hours*3600000);
    return {index,start,end,hours};
  });
  const sorted=[...sessions].sort((a,b)=>a.start.getTime()-b.start.getTime());
  for(let i=1;i<sorted.length;i++)if(sorted[i].start<sorted[i-1].end)throw Error('Le sessioni dei brani non possono sovrapporsi.');
  return sessions;
}

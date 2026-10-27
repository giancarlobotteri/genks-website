import {recordingStartAllowed} from './recording-selection.ts';
export type StudioDay={date:string;allSlots:string[];durationsBySlot:Record<string,number[]>};
export const durationLabel=(hours:number)=>{const minutes=Math.round(hours*60),h=Math.floor(minutes/60),m=minutes%60;return [h?`${h} ${h===1?'ora':'ore'}`:'',m?`${m} min`:''].filter(Boolean).join(' ');};
export function dayHasAvailability(day:StudioDay,payment:string,now:number,minimum=.25){return Object.entries(day.durationsBySlot).some(([time,durations])=>durations.some(h=>h>=minimum)&&recordingStartAllowed(day.date,time,payment,now));}
export function studioSlotAvailable(day:StudioDay|undefined,time:string,hours:number,payment:string,now:number){return Boolean(day?.durationsBySlot[time]?.includes(hours)&&recordingStartAllowed(day.date,time,payment,now));}

"use client";
import {useId,type ReactNode} from 'react';
export function TrackStepper({value,onChange,max=1000,children}:{value:number;onChange:(value:number)=>void;max?:number;children?:ReactNode}){
 const id=useId(),count=Math.max(1,Math.min(max,value));
 return <fieldset className="artist-stepper track-stepper"><legend id={id}>Tracce audio separate</legend><div><button type="button" aria-label="Diminuisci le tracce audio separate" disabled={count<=1} onClick={()=>onChange(count-1)}>−</button><label><span className="sr-only">Numero di tracce audio separate</span><input aria-labelledby={id} type="number" inputMode="numeric" min={1} max={max} step={1} readOnly={max===1} value={count} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=max)onChange(n);}}/></label><button type="button" aria-label="Aumenta le tracce audio separate" disabled={count>=max} onClick={()=>onChange(count+1)}>+</button></div>{children&&<small>{children}</small>}</fieldset>;
}

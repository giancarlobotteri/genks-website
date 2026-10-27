"use client";
import {useId} from 'react';
export function ArtistStepper({value,onChange}:{value:number;onChange:(value:number)=>void}){
 const id=useId(),count=Math.max(1,Math.min(20,value));
 return <fieldset className="artist-stepper"><legend id={id}>Quanti artisti partecipano al brano?</legend><div><button type="button" aria-label="Diminuisci il numero di artisti" disabled={count<=1} onClick={()=>onChange(count-1)}>−</button><label><span className="sr-only">Numero di artisti</span><input aria-labelledby={id} type="number" min={1} max={20} step={1} value={count} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=20)onChange(n);}}/></label><button type="button" aria-label="Aumenta il numero di artisti" disabled={count>=20} onClick={()=>onChange(count+1)}>+</button></div><small>Nessun supplemento: lavorazione inclusa.</small></fieldset>;
}

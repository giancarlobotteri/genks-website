export function cashHoldUntil(created:number,start:number){if(!Number.isFinite(created)||!Number.isFinite(start)||start<=created)throw Error('Data non valida.');return new Date(created+(start-created)/2);}
export function cashHoldLabel(created:number,start:number){return cashHoldUntil(created,start).toLocaleString('it-IT',{timeZone:'Europe/Rome',dateStyle:'long',timeStyle:'short'});}

export function validateTransfer(value:string,thirtyDays:unknown){
 let u:URL;try{u=new URL(value);}catch{throw Error('Inserisci il link SwissTransfer alle tracce audio separate.');}
 if(u.protocol!=='https:'||!['www.swisstransfer.com','swisstransfer.com'].includes(u.hostname)||u.username||u.password||!/^\/d\/[a-zA-Z0-9-]{16,}/.test(u.pathname))throw Error('Usa un collegamento SwissTransfer valido alle tracce audio separate.');
 if(thirtyDays!==true)throw Error('Imposta la scadenza del trasferimento a 30 giorni e confermala.');
 return u.href;
}

/** New agreements only. Activate only with the matching checkout and booking integration. */
export const pricingVersion = '2026-10-27-v10';
export const ratesV10 = {
  master: 2999, beat: 3499, recordingHour: 1999, nightHour: 2999,
  masterPack: 6999, fiveHours: 7999, voiceBase: 1999, turnkeyBase: 4999,
  includedHoursPerSong: 2, extraTrack: 250,
} as const;
export const mixTiersV10 = [
  {min:1,max:8,price:2999}, {min:9,max:16,price:4999},
  {min:17,max:24,price:6999}, {min:25,max:36,price:8999},
  {min:37,max:48,price:11999},
] as const;
function integer(value:number,min:number,max=Number.MAX_SAFE_INTEGER){
  if(!Number.isSafeInteger(value)||value<min||value>max)throw Error('Valore numerico non valido.');
  return value;
}
function cents(value:number){return integer(value,0);}
export function mixPriceV10(tracks:number){
  integer(tracks,1);
  return cents(mixTiersV10.find(t=>tracks<=t.max)?.price??11999+cents((tracks-48)*ratesV10.extraTrack));
}
export function audioPriceV10(service:'mix'|'master'|'mix_master',tracks:number){
  if(!['mix','master','mix_master'].includes(service))throw Error('Servizio non valido.');
  integer(tracks,1);
  return service==='master'?ratesV10.master:mixPriceV10(tracks)+(service==='mix_master'?ratesV10.master:0);
}
export function recordingPriceV10(dayMinutes:number,nightMinutes:number){
  integer(dayMinutes,0);integer(nightMinutes,0);
  return cents(Math.round(dayMinutes*ratesV10.recordingHour/60)+Math.round(nightMinutes*ratesV10.nightHour/60));
}
export function realSavingV10(separate:number,total:number){return Math.max(0,cents(separate)-cents(total));}
export function fixedPackageV10(kind:'masters'|'hours'){
  if(kind!=='masters'&&kind!=='hours')throw Error('Pacchetto non valido.');
  const total=kind==='masters'?ratesV10.masterPack:ratesV10.fiveHours;
  const separate=kind==='masters'?3*ratesV10.master:5*ratesV10.recordingHour;
  return {total,separate,saving:realSavingV10(separate,total)};
}
export function studioPackageV10(kind:'voice'|'turnkey',tracks:number,minutes:number,nightMinutes=0){
  if(kind!=='voice'&&kind!=='turnkey')throw Error('Pacchetto non valido.');
  integer(minutes,15);integer(nightMinutes,0,minutes);
  const audio=audioPriceV10('mix_master',tracks);
  const recording=recordingPriceV10(minutes-nightMinutes,nightMinutes);
  const base=kind==='voice'?ratesV10.voiceBase:ratesV10.turnkeyBase;
  const total=cents(base+audio+recording);
  const separate=audio+recording+(kind==='turnkey'?ratesV10.beat:0);
  return {base,audio,recording,total,separate,saving:realSavingV10(separate,total)};
}
export type ProjectSongV10={tracks:number;source:'genks'|'external'};
export function projectPackageV10(format:'ep'|'album',songs:ProjectSongV10[]){
  if(!['ep','album'].includes(format)||!Array.isArray(songs)||songs.length<2||songs.length>20)throw Error('Progetto non valido.');
  const rows=songs.map(s=>{
    if(!s||s.source!=='genks')throw Error('EP e album comprendono solo produzioni GENKS, anche in collaborazione con altri producer.');
    const base=ratesV10.beat;
    const mix=mixPriceV10(s.tracks),master=ratesV10.master;
    const total=cents(base+mix+master);
    const recordingMinutes=ratesV10.includedHoursPerSong*60;
    const separate=(s.source==='genks'?ratesV10.beat:0)+mix+master+ratesV10.includedHoursPerSong*ratesV10.recordingHour;
    return {base,mix,master,total,separate,recordingMinutes,saving:realSavingV10(separate,total)};
  });
  const total=cents(rows.reduce((n,r)=>n+r.total,0)),separate=cents(rows.reduce((n,r)=>n+r.separate,0));
  return {format,rows,total,separate,saving:realSavingV10(separate,total),includedMinutes:rows.reduce((n,r)=>n+r.recordingMinutes,0)};
}
/** Genuine old mix prices, never an invented comparison for new tiers above 48. */
export function previousAudioPriceV10(service:'mix'|'master'|'mix_master',tracks:number){
  integer(tracks,1);
  if(service==='master')return 2999;
  if(tracks>48)return null;
  const tier=tracks<=8?0:tracks<=24?1:2;
  return service==='mix'?[5999,8999,13999][tier]:[7999,10499,14999][tier];
}

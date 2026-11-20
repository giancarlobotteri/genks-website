import { demoContent } from '../../genks-virtual-studio/src/data/fixtures.ts';
import { audioPrice } from '../../genks-virtual-studio/src/lib/catalog.ts';
import {validateTransfer} from './swiss-transfer.ts';
import { buildRecordingQuote } from './recording-quote.ts';
import { firstVersionEstimate } from './service-delivery.ts';
import { withStudioDepositAndFinalBalance } from './studio-deposit-final-balance.ts';
import type { OrderPart, OrderQuote, OrderSelection } from './service-order-v8.ts';

export type CinematicOrder = {
  kind: 'booking' | 'remote-project' | 'custom-beat' | 'bundle';
  data: Record<string, string>;
  payment: 'card' | 'cash';
};
export function quoteCinematicOrder(input: CinematicOrder, early = false, now = new Date()): OrderQuote {
  if (!input || !['booking','remote-project','custom-beat','bundle'].includes(input.kind) ||
      !['card','cash'].includes(input.payment) || !input.data || typeof input.data !== 'object') throw Error('Ordine non valido.');
  const d = input.data;
  if (Object.values(d).some(value => typeof value !== 'string' || value.length > 5000)) throw Error('Dettagli non validi.');
  let total = 0, listTotal = 0, hours = 0, studioAmount = 0, customAmount = 0, creditMinutes = 0;
  let title = '', service: OrderSelection['kind'] = 'custom', packageCode = '';
  const songs: OrderSelection['songs'] = [];
  let guarantees: OrderPart['guarantees'] = [];
  let lines: OrderPart['lines'] = [];
  const date = d.date || '', time = d.time || '';
  if (input.kind === 'booking') {
    const pack = demoContent.recording.find(p => p.id === d.packageId);
    const isBlock = d.recordingMode === 'block';
    hours = d.recordingMode ? Number(d.hours) : pack?.hours ?? 0;
    if (!Number.isFinite(hours) || hours < 1 || hours > (isBlock ? 5 : 8) || hours * 2 % 1 !== 0) throw Error('Scegli una durata valida.');
    if (isBlock) { packageCode = 'hours'; creditMinutes = 300; }
    const base = isBlock ? demoContent.recording.find(p => p.id === 'rec-5h')!.price! : Math.round(hours * demoContent.recording[0].price!);
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date) || !/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(time)) throw Error('Scegli giorno e ora.');
    const recording = buildRecordingQuote(date, time, hours);
    title = isBlock ? 'Blocco 5 ore di registrazione' : `Registrazione · ${hours} ore`; service = isBlock ? 'package' : 'recording';
    total = Math.max(2000, base + recording.night);
    studioAmount = total;
    lines = [{name: title, amount: base}, ...(recording.night ? [{name:'Supplemento notturno',amount:recording.night}] : []),
      ...(total > base + recording.night ? [{name:'Minimo prenotazione studio',amount:total-base-recording.night}] : [])];
    listTotal = total;
  } else if (input.kind === 'remote-project') {
    const audio = d.serviceId;
    if (!['mix','master','mixmaster'].includes(audio)) throw Error('Servizio audio non valido.');
    const tracks = Number(d.stems);
    if (!Number.isInteger(tracks) || tracks < 1 || tracks > 1000) throw Error('Controlla le tracce audio separate.');
    const transfer = validateTransfer(d.fileUrl || '', d.filesThirtyDays === 'on');
    title = demoContent.mix.find(m => m.id === audio)!.name;
    service = audio === 'mixmaster' ? 'mix_master' : audio as 'mix' | 'master';
    total = listTotal = audioPrice(audio, tracks);
    songs.push({trackTitle:d.title?.trim() || 'Brano',trackCount:audio==='master'?1:tracks,artists:audio==='master'?0:1,revisions:0,rush:false,fileUrl:transfer,production:'external',filesThirtyDays:true});
    guarantees = [{title:songs[0].trackTitle,amount:Math.round(total*.3)}];
    lines = [{name:title + ' · ' + tracks + ' tracce audio separate · una revisione inclusa',amount:total}];
  } else if (input.kind === 'custom-beat') {
    total = listTotal = demoContent.customBeat.priceFrom!;
    title = 'Beat GENKS su misura'; customAmount = total;
    songs.push({trackTitle:'Beat su misura',trackCount:1,artists:0,revisions:0,rush:false,fileUrl:'',production:'genks'});
    lines = [{name:title+' · split 50/50 · una revisione inclusa',amount:total}];
  } else {
    const pack = demoContent.bundles.find(p => p.id === d.bundleId && p.status === 'published');
    if (!pack || pack.price == null) throw Error('Pacchetto non disponibile.');
    title = pack.name; total = pack.price; listTotal = pack.listValue ?? total;
    packageCode = ({'pk-beat-voice':'beat_voice','pk-masters':'master','pk-voice':'voice','pk-hours':'hours','pk-turnkey':'turnkey','pk-ep':'ep'} as Record<string,string>)[pack.id];
    service = 'package';
    creditMinutes = ({'pk-beat-voice':120,'pk-voice':60,'pk-hours':300,'pk-turnkey':60,'pk-ep':480} as Record<string,number>)[pack.id] ?? 0;
    studioAmount = Math.min(total, Math.round(creditMinutes / 60 * 1999));
    customAmount = ['pk-beat-voice','pk-turnkey','pk-ep'].includes(pack.id) ? Math.min(total, demoContent.customBeat.priceFrom! * (pack.id==='pk-ep'?4:1)) : 0;
    lines = [{name: title + (creditMinutes ? ' · '+creditMinutes/60+' ore da prenotare' : '')+' · '+pack.includes.join(' · '),amount:total}];
    if (['pk-beat-voice','pk-turnkey','pk-ep','pk-voice'].includes(pack.id)) {
      for (let i=0; i<(pack.id==='pk-ep'?4:1); i++) songs.push({trackTitle:'Brano '+(i+1),trackCount:1,artists:1,revisions:0,rush:false,fileUrl:'',production:pack.id==='pk-voice'?'external':'genks'});
    }
    if (pack.id === 'pk-masters') {
      const transfer = validateTransfer(d.fileUrl || '', d.filesThirtyDays === 'on');
      for(let i=0;i<3;i++) songs.push({trackTitle:'Brano '+(i+1),trackCount:1,artists:0,revisions:0,rush:false,fileUrl:transfer,production:'external',filesThirtyDays:true});
      guarantees = [{title,amount:Math.round(total*.3)}];
    }
  }
  if (!Number.isSafeInteger(total) || total < 50) throw Error('Prezzo non disponibile.');
  const selection: OrderSelection = {kind:service,packageCode,songs,hours,extraHours:0,date,time,payment:input.payment,notes:JSON.stringify(d).slice(0,2000),rights:customAmount?'split50':'own'};
  const part: OrderPart = {selection,title,total,listTotal,saving:Math.max(0,listTotal-total),deposit:total,dueNow:total,cardNow:input.payment==='card'?total:0,cashNow:0,balance:input.payment==='cash'?total:0,studioAmount,customAmount,hours,guarantees,lines,firstVersion:input.kind==='booking'?null:firstVersionEstimate(now,false,early,customAmount?10:7),...(creditMinutes?{creditMinutes}:{}),...(input.kind==='booking'?{standaloneRecording:true,bookingAmount:packageCode === 'hours' ? Math.max(2000, Math.round((total - buildRecordingQuote(date,time,hours).night) * hours / 5) + buildRecordingQuote(date,time,hours).night) : total,cashDepositAtArrival:input.payment==='cash',studioPaidInFullByCard:input.payment==='card'}:{})};
  return withStudioDepositAndFinalBalance({version:'2026-10-26-commerce-v8',parts:[part],total,cardNow:part.cardNow,cashNow:0,balance:part.balance,saving:part.saving});
}

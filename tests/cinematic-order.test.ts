import {describe,it} from 'node:test';
import assert from 'node:assert/strict';
import {quoteCinematicOrder} from '../src/lib/cinematic-order.ts';

const audio={kind:'remote-project' as const,payment:'card' as const,data:{serviceId:'mix',stems:'8',title:'Prova',fileUrl:'https://www.swisstransfer.com/d/00000000-0000-0000-0000-000000000000',filesThirtyDays:'on',total:'0,01 €'}};
describe('listino Claude ricalcolato dal server',()=>{
  it('ignora il totale del browser e usa gli stessi prezzi del nuovo catalogo',()=>{
    assert.equal(quoteCinematicOrder(audio).total,3999);
    assert.equal(quoteCinematicOrder({...audio,data:{...audio.data,stems:'9'}}).total,5999);
    assert.equal(quoteCinematicOrder({...audio,data:{...audio.data,serviceId:'master'}}).total,2499);
    assert.equal(quoteCinematicOrder({...audio,data:{...audio.data,serviceId:'mixmaster',stems:'9'}}).total,7999);
  });
  it('il beat viene dal catalogo Claude e si paga intero con carta',()=>{
    const q=quoteCinematicOrder({kind:'custom-beat',payment:'card',data:{}});
    assert.equal(q.total,7999);assert.equal(q.cardNow,7999);assert.equal(q.balance,0);
  });
  it('in contanti il solo mix si salda a fine lavoro',()=>{
    const q=quoteCinematicOrder({...audio,payment:'cash'});
    assert.equal(q.cashNow,0);assert.equal(q.balance,3999);
  });
  it('applica 20 euro alla prenotazione in studio anche da un’ora',()=>{
    const q=quoteCinematicOrder({kind:'booking',payment:'cash',data:{packageId:'rec-1h',date:'2030-01-02',time:'19:30'}});
    assert.equal(q.total,2000);assert.equal(q.cashNow,2000);assert.equal(q.parts[0].bookingDeposit,2000);
    assert.equal(q.parts[0].lines.reduce((n,line)=>n+line.amount,0),q.total);
  });
  it('tutti i pacchetti derivano dal catalogo',()=>{
    for(const [bundleId,total] of [['pk-beat-voice',9999],['pk-voice',6999],['pk-hours',7999],['pk-turnkey',14999],['pk-ep',64999]] as const) {
      const q=quoteCinematicOrder({kind:'bundle',payment:'card',data:{bundleId}});
      assert.equal(q.total,total);assert.equal(q.cardNow,total);
    }
  });
  it('rifiuta SwissTransfer mancante e scadenza non confermata',()=>{
    assert.throws(()=>quoteCinematicOrder({...audio,data:{...audio.data,fileUrl:''}}));
    assert.throws(()=>quoteCinematicOrder({...audio,data:{...audio.data,filesThirtyDays:''}}));
  });
  it('non accetta sottodomini arbitrari o link senza identificativo del trasferimento',()=>{
    for (const fileUrl of ['https://fake.swisstransfer.com/d/00000000000000000','https://www.swisstransfer.com/d/prova']) assert.throws(()=>quoteCinematicOrder({...audio,data:{...audio.data,fileUrl}}));
  });
  it('EP conserva quattro brani GENKS e tutte le ore senza inventare appuntamenti',()=>{
    const q=quoteCinematicOrder({kind:'bundle',payment:'cash',data:{bundleId:'pk-ep'}});
    assert.equal(q.parts[0].selection.songs.length,4);
    assert(q.parts[0].selection.songs.every(s=>s.production==='genks'));
    assert.equal(q.parts[0].creditMinutes,480);
    assert.equal(q.cashNow,0);
    assert.equal(q.balance,q.total);
    assert.equal(q.parts[0].selection.date,'');
    assert.match(q.parts[0].lines[0].name,/4 beat GENKS/);
  });
});


it('holds a ninety-minute cash session until arrival and quotes only the cash deposit upfront',()=>{
  const q=quoteCinematicOrder({kind:'booking',payment:'cash',data:{recordingMode:'hourly',hours:'1.5',date:'2026-11-27',time:'23:30'}});
  assert.equal(q.total,3999);
  assert.equal(q.cashNow,2000);
  assert.equal(q.balance,1999);
  assert.equal(q.parts[0].cashDepositAtArrival,true);
  const card=quoteCinematicOrder({kind:'booking',payment:'card',data:{recordingMode:'hourly',hours:'1.5',date:'2026-11-27',time:'23:30'}});
  assert.equal(card.parts[0].cashDepositAtArrival,false);
  assert.equal(card.cardNow,3999);
  assert.equal(card.balance,0);
});
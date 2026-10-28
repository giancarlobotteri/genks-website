import {normalizeQuoteRequest} from '../src/lib/chatbot/quote-request.ts';
import {quotePreventivo} from '../src/lib/chatbot/checkout.ts';
import {codificaPreventivo} from '../src/lib/chatbot/pricing.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectIntake,projectSongCount} from '../src/lib/chatbot/project-intake.ts';
import {calcolaPreventivo} from '../src/lib/chatbot/pricing.ts';
const u=(content:string)=>({role:'user' as const,content});
test('EP asks only for the missing song count and already includes production and audio',()=>{const q=projectIntake([u('Vorrei un EP')]);assert.ok(q&&'reply' in q);assert.match(q.reply,/Quanti brani/);assert.doesNotMatch(q.reply,/hai già le basi|quanti file/i);});
test('six-song GENKS project is quoted once without asking already included services',()=>{const q=projectIntake([u('Vorrei un EP da 6 brani')]);assert.ok(q&&'input' in q);assert.equal(q.input.progetto!.brani.length,6);assert.equal(q.input.progetto!.registrazione,true);assert.equal(calcolaPreventivo(q.input).importi_centesimi.totale,53999);const again=projectIntake([u('EP da 6 brani'),u('posso aggiungere le registrazioni?')]);assert.ok(again&&'input' in again);assert.equal(again.input.progetto!.brani.length,6);});
test('external beats are not silently charged as GENKS productions',()=>{const q=projectIntake([u('EP da 4 brani, ho già le basi esterne')]);assert.ok(q&&'reply' in q);assert.match(q.reply,/singolarmente/);});
test('bare count answers are recognized only following a count question',()=>{for(const n of ['6','sei','sono 6'])assert.equal(projectSongCount([u('EP'),{role:'assistant',content:'Quanti brani vuoi includere?'},u(n)]),6);});
test('the selected count survives subsequent replies and a correction replaces the original count',()=>{
 const base=[u('EP con produzioni GENKS'),{role:'assistant' as const,content:'Quanti brani vuoi includere nel progetto?'},u('6'),{role:'assistant' as const,content:'Vuoi mix, master, entrambi oppure nessuna lavorazione audio?'},u('entrambi')];
 const result=projectIntake(base);assert.ok(result&&'input' in result);assert.equal(result.input.progetto!.brani.length,6);
 const changed=projectIntake([...base,u('anzi facciamo 4 brani')]);assert.ok(changed&&'input' in changed);assert.equal(changed.input.progetto!.brani.length,4);
});
test('track, artist and studio hour answers cannot overwrite the selected song count',()=>{
 for(const question of ['Quante tracce audio separate hai?','Quanti artisti partecipano?','Quante ore vuoi registrare?']){
  const result=projectIntake([u('EP da 6 brani con produzioni GENKS e mix e master'),{role:'assistant',content:question},u('8')]);
  assert.ok(result&&'input' in result);assert.equal(result.input.progetto!.brani.length,6);
 }
});
test('an invalid bare count is acknowledged instead of repeating the same count question',()=>{
 const result=projectIntake([u('EP con produzioni GENKS'),{role:'assistant',content:'Quanti brani vuoi includere nel progetto?'},u('0')]);assert.ok(result&&'reply' in result);assert.match(result.reply,/da 2 a 20/);
});

test('mixed track distribution survives a request for separately booked studio time',()=>{
 const initial=u('EP da 4 brani: due da 8, uno da 18 e uno da 30 tracce');
 const first=projectIntake([initial]);assert.ok(first&&'input' in first);assert.deepEqual(first.input.progetto!.brani.map(b=>b.tracce),[8,8,18,30]);
 const updated=projectIntake([initial,u('aggiungi 2 ore extra di registrazione')]);assert.ok(updated&&'input' in updated);assert.equal(updated.input.progetto!.ore_extra,0);assert.deepEqual(updated.input.progetto!.brani.map(b=>b.tracce),[8,8,18,30]);
 const normalized=normalizeQuoteRequest(updated.input,'aggiungi 2 ore extra di registrazione');assert.equal(normalized.progetto!.ore_extra,0);
 const p=calcolaPreventivo(normalized),q=quotePreventivo(codificaPreventivo(normalized));assert.equal(p.importi_centesimi.totale,45999);assert.equal(q.total,45999);assert.equal(q.balance,0);assert.equal(q.parts[0].selection.appointments!.reduce((n,a)=>n+a.extraHours,0),0);
});
test('a correction changes only the selected song and explicit removal clears extra hours',()=>{const history=[u('Album da 4 brani, tutti da 8 tracce, 1 ora extra per brano'),u('brano 2 con 50 tracce')];const q=projectIntake(history);assert.ok(q&&'input' in q);assert.deepEqual(q.input.progetto!.brani.map(b=>b.tracce),[8,50,8,8]);assert.equal(q.input.progetto!.ore_extra,0);const removed=projectIntake([...history,u('togli le ore extra')]);assert.ok(removed&&'input' in removed);assert.equal(removed.input.progetto!.ore_extra,0);});
test('external production choice is not forgotten on a later count answer',()=>{const q=projectIntake([u('Voglio un EP, ho già le basi esterne'),u('6 brani')]);assert.ok(q&&'reply' in q);assert.match(q.reply,/singolarmente/);});
test('incomplete track distribution asks for clarification rather than inventing the remaining songs',()=>{const q=projectIntake([u('EP da 6 brani: due da 8 e uno da 18 tracce')]);assert.ok(q&&'reply' in q);assert.match(q.reply,/distribuzione/);});

test('EP and album never quote additional studio hours, but explain a new booking',()=>{for(const format of ['EP','album']){const q=projectIntake([u(`${format} da 4 brani, aggiungi 3 ore extra`)]);assert.ok(q&&'input' in q);assert.equal(q.input.progetto!.ore_extra,0);assert.equal(calcolaPreventivo(q.input).importi_centesimi.totale,35999);}});

test('a new standalone request is not trapped in previous EP configuration',()=>{const history=[u('Vorrei un EP da 4 brani')];for(const text of ['Quanto costa mix e master di un brano con 12 tracce?','Voglio registrare 4 ore'])assert.equal(projectIntake([...history,u(text)]),null);});

test('short project corrections change count without a repeated questionnaire',()=>{const q=projectIntake([u('EP da 6 brani'),u('anzi cinque'),u('tutti da 16')]);assert.ok(q&&'input'in q);assert.equal(q.input.progetto!.brani.length,5);assert.deepEqual(q.input.progetto!.brani.map(b=>b.tracce),[16,16,16,16,16]);});

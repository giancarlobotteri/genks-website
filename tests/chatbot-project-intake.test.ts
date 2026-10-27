import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectIntake,projectSongCount} from '../src/lib/chatbot/project-intake.ts';
import {calcolaPreventivo} from '../src/lib/chatbot/pricing.ts';
const u=(content:string)=>({role:'user' as const,content});
test('EP asks only for the missing song count and already includes production and audio',()=>{const q=projectIntake([u('Vorrei un EP')]);assert.ok(q&&'reply' in q);assert.match(q.reply,/Quanti brani/);assert.doesNotMatch(q.reply,/hai già le basi|quanti file/i);});
test('six-song GENKS project is quoted once without asking already included services',()=>{const q=projectIntake([u('Vorrei un EP da 6 brani')]);assert.ok(q&&'input' in q);assert.equal(q.input.progetto!.brani.length,6);assert.equal(q.input.progetto!.registrazione,true);assert.equal(calcolaPreventivo(q.input).importi_centesimi.totale,56982);const again=projectIntake([u('EP da 6 brani'),u('posso aggiungere le registrazioni?')]);assert.ok(again&&'input' in again);assert.equal(again.input.progetto!.brani.length,6);});
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

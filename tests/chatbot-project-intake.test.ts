import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectIntake} from '../src/lib/chatbot/project-intake.ts';
import {prepareQuoteArguments} from '../src/lib/chatbot/quote-request.ts';
import {quoteInputSchema,quotePreventivo} from '../src/lib/chatbot/checkout.ts';
import {calcolaPreventivo,codificaPreventivo} from '../src/lib/chatbot/pricing.ts';
const u=(content:string)=>({role:'user' as const,content});
test('an EP starts with production choice, never a list of file questions',()=>{
 const r=projectIntake([u('Vorrei fare un EP')]);assert.ok(r&&'reply' in r);assert.match(r.reply,/produzioni su misura GENKS/);assert.doesNotMatch(r.reply,/quante tracce|quanti file|mix pronto/i);
});
test('six new GENKS productions with mix and master work without imaginary file counts or model',()=>{
 const r=projectIntake([u('Vorrei un EP'),{role:'assistant',content:'Quanti brani e quante tracce hai?'},u('i brani saranno 6, mi servono le produzioni musicali, non lo so perché non ho i beat, voglio sia mix che master')]);
 assert.ok(r&&'input' in r);const input=quoteInputSchema.parse(r.input);assert.equal(input.progetto!.brani.length,6);assert.ok(input.progetto!.brani.every(b=>b.produzione==='genks'&&b.servizio==='mix_master'&&b.tracce===8));assert.equal(input.progetto!.registrazione,false);
 const quote=calcolaPreventivo(input),checkout=quotePreventivo(codificaPreventivo(input));assert.equal(quote.importi_centesimi.totale,89993);assert.equal(checkout.total,quote.importi_centesimi.totale);assert.equal(checkout.cardNow,quote.importi_centesimi.subito);
});
test('follow-up after a previous failure recovers from customer choices, not assistant claims',()=>{
 const history=[u('EP da 6 brani con produzioni GENKS, mix e master'),{role:'assistant' as const,content:'Ho corretto il preventivo e ti rispondo tra un attimo.'},u('quindi?')];const r=projectIntake(history);assert.ok(r&&'input' in r);assert.equal(r.input.progetto!.brani.length,6);
});
test('mixed bases require a song choice instead of charging GENKS production for all',()=>{
 const r=projectIntake([u('EP da 4 brani, due beat GENKS e gli altri li ho già, mix e master')]);assert.ok(r&&'reply' in r);assert.match(r.reply,/quali brani/);
});
test('existing bases are not charged as new GENKS productions',()=>{
 assert.equal(projectIntake([u('EP da 6 brani, ho già le basi di altri producer, voglio mix e master')]),null);
});
test('missing tool defaults are completed without inventing source, service or paid extras',()=>{
 const raw={progetto:{brani:[{produzione:'genks',servizio:'mix_master'},{produzione:'external',servizio:'master'}]}};
 const input=quoteInputSchema.parse(prepareQuoteArguments(raw));assert.equal(input.progetto!.registrazione,false);assert.equal(input.progetto!.ore_extra,0);assert.ok(input.progetto!.brani.every(b=>b.revisioni_extra===0&&!b.consegna_veloce&&b.artisti===1));
 assert.throws(()=>quoteInputSchema.parse(prepareQuoteArguments({progetto:{brani:[{servizio:'mix_master'},{}]}})));
});

test('brief follow-ups retain count and service without asking the same questions',()=>{
 const r=projectIntake([u('Un EP da 6'),u('GENKS'),u('mix e master')]);assert.ok(r&&'input' in r);assert.equal(r.input.progetto!.brani.length,6);
 assert.equal(projectIntake([u('EP da 4 brani, mix e master'),u('le ho già')]),null);
});
test('per-song mixed choices leave intake instead of repeating the same question forever',()=>{
 const r=projectIntake([u('EP da 4 brani, due beat GENKS e gli altri li ho già, mix e master'),{role:'assistant',content:'Per quali brani?'},u('brani 1 e 2 GENKS, brani 3 e 4 ho già le basi')]);assert.equal(r,null);
});

test('a bare numeral, spelled quantity and short sentence answer the immediately previous count question',()=>{
 for(const answer of ['6','sei','sono 6','ne vorrei sei','6 in tutto','sei!']){
  const result=projectIntake([u('Vorrei un EP'),{role:'assistant',content:'Vuoi produzioni GENKS o hai già le basi?'},u('GENKS'),{role:'assistant',content:'Quanti brani vuoi includere nel progetto?'},u(answer)]);
  assert.ok(result&&'reply' in result);assert.match(result.reply,/mix, master, entrambi/);assert.doesNotMatch(result.reply,/Quanti brani/);
 }
});
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

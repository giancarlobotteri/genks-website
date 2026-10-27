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

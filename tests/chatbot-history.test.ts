import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chatRequestHistory} from '../src/lib/chatbot/history.ts';
import {projectIntake} from '../src/lib/chatbot/project-intake.ts';
test('longer conversations retain the EP, production choice and short count answer',()=>{
 const history=[{role:'user' as const,content:'Vorrei un EP'},{role:'assistant' as const,content:'Vuoi produzioni GENKS?'},{role:'user' as const,content:'GENKS'},{role:'assistant' as const,content:'Quanti brani vuoi includere nel progetto?'},{role:'user' as const,content:'sei'},{role:'assistant' as const,content:'Mix, master, entrambi oppure nessuna lavorazione audio?'},{role:'user' as const,content:'entrambi'},{role:'assistant' as const,content:'Ecco il preventivo'}];
 for(let i=0;i<10;i++)history.push({role:'user',content:'quindi?'},{role:'assistant',content:'Il preventivo rimane disponibile.'});history.push({role:'user',content:'riprendiamo'});
 const sent=chatRequestHistory(history);assert.equal(sent.length,11);assert.equal(sent[0].role,'user');assert.equal(sent.at(-1)?.content,'riprendiamo');const result=projectIntake(sent);assert.ok(result&&'input' in result);assert.equal(result.input.progetto!.brani.length,6);
});
test('short histories are unchanged and every message remains bounded',()=>{const history=[{role:'user' as const,content:'EP'},{role:'assistant' as const,content:'Quanti brani?'},{role:'user' as const,content:'6'}];assert.deepEqual(chatRequestHistory(history),history);assert.equal(chatRequestHistory([{role:'user',content:'x'.repeat(2000)}])[0].content.length,1000);});

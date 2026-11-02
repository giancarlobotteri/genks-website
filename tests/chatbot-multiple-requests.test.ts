import {test} from 'node:test';
import assert from 'node:assert/strict';
import {splitChatRequests,combineChatReplies} from '../src/lib/chatbot/multiple-requests.ts';
import {projectIntake} from '../src/lib/chatbot/project-intake.ts';
import {reviewQuote} from '../src/lib/chatbot/review.ts';
test('independent questions split without fragmenting mix and master or track distributions',()=>{
 for(const text of ['Quanto costa il master? Come pago?','Quanto costa il master e come pago?','Quanto costa il master; inoltre posso cancellare?'])assert.equal(splitChatRequests(text).length,2);
 assert.equal(splitChatRequests('EP da 4 brani: due da 8 e due da 18 tracce').length,1);
});
test('GENKS songs described as tracce are not confused with stems',()=>{
 const r=projectIntake([{role:'user',content:'Voglio 2 tracce con beat di GENKS, mix e master e 2 ore di rec per brano'}]);assert.ok(r&&'input'in r);assert.equal(r.input.progetto!.brani.length,2);assert.deepEqual(r.input.progetto!.brani.map(s=>s.tracce),[8,8]);
 assert.doesNotMatch(reviewQuote(r.input).reply,/Quante tracce|se cambia, il totale/);assert.match(reviewQuote(r.input).reply,/non devi conoscere/);
});
test('only one review survives alongside informational answers',()=>{const draft={beat_su_misura:1};assert.deepEqual(combineChatReplies([{reply:'quote',draft,review:true},{reply:'policy'}]).draft,draft);assert.equal(combineChatReplies([{reply:'a',draft},{reply:'b',draft}]).draft,undefined);});

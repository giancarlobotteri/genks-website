import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldSendChatMessage} from '../src/lib/chatbot/keyboard.ts';
test('Enter sends while Shift+Enter preserves a multiline question',()=>{
 assert.equal(shouldSendChatMessage({key:'Enter',shiftKey:false}),true);
 assert.equal(shouldSendChatMessage({key:'Enter',shiftKey:true}),false);
});
test('composing input is never submitted before its characters are committed',()=>{
 assert.equal(shouldSendChatMessage({key:'Enter',shiftKey:false,isComposing:true}),false);
 assert.equal(shouldSendChatMessage({key:'Enter',shiftKey:false,keyCode:229}),false);
 assert.equal(shouldSendChatMessage({key:'Enter',shiftKey:false,isComposing:false,keyCode:13}),true);
});
test('editing and navigation keys leave the message untouched',()=>{
 for(const key of ['a','Backspace','ArrowDown','Tab','Escape','Process'])assert.equal(shouldSendChatMessage({key,shiftKey:false}),false);
});

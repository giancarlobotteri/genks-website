import test from "node:test";
import assert from "node:assert/strict";
import {normalizeContact,contactOwner,contactToSave} from "../src/lib/customer-contact.ts";
test("saved contact only accepts bounded contact fields and discards injected ownership",()=>{
 assert.deepEqual(normalizeContact({name:"  Cliente Test ",artistName:" Artista ",phone:" +390000000 ",user_id:"other",role:"admin",email:"other@example.invalid",card:"secret"}),{name:"Cliente Test",artistName:"Artista",phone:"+390000000"});
 assert.equal(normalizeContact({name:"A",artistName:"",phone:""}),null);
 assert.equal(normalizeContact({name:"Cliente",artistName:"",phone:"0".repeat(41)}),null);
 assert.equal(normalizeContact({name:"Cliente",artistName:[],phone:""}),null);
 assert.equal(normalizeContact(null),null);
});
test("prefill requires a server-verified permanent account with confirmed email",()=>{
 assert.equal(contactOwner(null),null);
 assert.equal(contactOwner({id:"a",email:"test@example.invalid"}),null);
 assert.equal(contactOwner({id:"a",email:"test@example.invalid",email_confirmed_at:"2026-10-24",is_anonymous:true}),null);
 assert.deepEqual(contactOwner({id:"a",email:"test@example.invalid",email_confirmed_at:"2026-10-24"}),{userId:"a",email:"test@example.invalid"});
 assert.notEqual(contactOwner({id:"b",email:"b@example.invalid",email_confirmed_at:"2026-10-24"})?.userId,"a");
});

test("saving is opt-in and only updates the verified session's own contact",()=>{
 const user={id:"a",email:"a@example.invalid",email_confirmed_at:"2026-10-26"};
 const form=new FormData();for(const [k,v] of Object.entries({contactOwner:"a",name:"Cliente A",artistName:"Artista",phone:"1234567",email:"a@example.invalid"}))form.set(k,v);
 assert.equal(contactToSave(form,user),null);
 form.set("saveContact","on");assert.deepEqual(contactToSave(form,user),{name:"Cliente A",artistName:"Artista",phone:"1234567"});
 form.set("email","b@example.invalid");assert.throws(()=>contactToSave(form,user),/contact_email_mismatch/);
 form.set("email","a@example.invalid");assert.throws(()=>contactToSave(form,{...user,id:"b"}),/contact_session_changed/);
 form.delete("saveContact");assert.throws(()=>contactToSave(form,null),/contact_session_changed/);
 const guest=new FormData();assert.equal(contactToSave(guest,null),null);guest.set("saveContact","on");assert.throws(()=>contactToSave(guest,null),/contact_email_mismatch/);
});

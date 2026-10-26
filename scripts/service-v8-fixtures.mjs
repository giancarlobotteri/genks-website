import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {quoteOrder} from '../src/lib/service-order-v8.ts';
import {packages} from '../src/lib/service-catalog.ts';
const song=(tracks=8)=>({trackTitle:'Brano QA',trackCount:tracks,artists:0,revisions:0,rush:false,fileUrl:''});
const selection=(kind)=>({kind,songs:kind==='recording'?[]:[song(kind==='master'||kind==='custom'?1:8)],hours:kind==='recording'?2:0,extraHours:0,date:kind==='recording'?'2026-11-20':'',time:kind==='recording'?'19:30':'',payment:'card',notes:'Solo collaudo annullato',rights:kind==='custom'?'split50':'own'});
const cases=[];
for(const kind of ['mix','master','mix_master','recording','custom'])cases.push({name:kind,items:[selection(kind)]});
for(const [code,p] of Object.entries(packages))cases.push({name:code,items:[{...selection('package'),packageCode:code,songs:Array.from({length:p.songs},()=>song(p.service==='master'?1:8)),date:p.studio&&code!=='hours'?'2026-11-20':'',time:p.studio&&code!=='hours'?'19:30':'',rights:code==='turnkey'?'split50':'own'}]});
const extras=selection('mix_master');Object.assign(extras.songs[0],{trackCount:48,artists:4,revisions:2,rush:true});cases.push({name:'tutti-extra',items:[extras]});
cases.push({name:'carrello-misto',items:[selection('recording'),selection('mix_master')]});
cases.push({name:'contanti',items:[{...selection('recording'),payment:'cash'},selection('master')]});
let sql='';
for(let i=0;i<cases.length;i++){
 const c=cases[i];const quote={...quoteOrder(c.items,true),requestId:randomUUID()};const data={name:'Cliente QA',email:'qa-genks@example.invalid',phone:'0000000000',accepted:'on',earlyStart:true,withdrawalAcknowledged:true};
 const literal=v=>"'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb";
 sql+=`\nsavepoint qa_${i};\nselect set_config('request.jwt.claims','{"role":"service_role"}',true);\ndo $qa$ declare r jsonb; qid uuid; pid uuid;pay uuid; cnt integer; begin\n`;
 sql+=`r:=public.reserve_service_cart_v8(${literal(data)},${literal(quote)},repeat('Condizioni collaudo ',12),'Solo collaudo transazionale, nessuna email inviata');\npid:=(r->>'project_id')::uuid;qid:=(r->>'quote_id')::uuid;\n`;
 sql+=`if (select count(*) from public.service_order_parts_v8 where project_id=pid)<>${quote.parts.length} then raise exception 'part_count';end if;\n`;
 sql+=`if (public.reserve_service_cart_v8(${literal(data)},${literal(quote)},repeat('Condizioni collaudo ',12),'Solo collaudo transazionale, nessuna email inviata')->>'project_id')::uuid<>pid then raise exception 'idempotency';end if;\n`;
 if(quote.cardNow){sql+=`update public.service_quotes set stripe_session_id='cs_test_v8_${i}',status='open' where id=qid;\npay:=public.settle_service_cart_v8(qid,'cs_test_v8_${i}','pi_test_v8_${i}',${quote.cardNow},'eur',false,'evt_qa_${i}',now());\nif pay is null then raise exception 'payment_missing';end if;\nif public.settle_service_cart_v8(qid,'cs_test_v8_${i}','pi_test_v8_${i}',${quote.cardNow},'eur',false,'evt_qa_${i}',now())<>pay then raise exception 'duplicate_payment';end if;\n`;
 sql+=`if exists(select 1 from public.service_order_parts_v8 a join public.bookings b on b.id=a.booking_id where a.project_id=pid and a.method='card' and b.status<>'confirmed') then raise exception 'booking_not_confirmed';end if;\n`;}
 sql+=`if exists(select 1 from public.service_order_parts_v8 a join public.bookings b on b.id=a.booking_id where a.project_id=pid and a.method='cash' and b.status='confirmed') then raise exception 'cash_confirmed_early';end if;\n`;
 if(c.name==='contanti')sql+=`perform public.receive_service_part_v8((select id from public.service_order_parts_v8 where project_id=pid and method='cash'),'initial');if exists(select 1 from public.service_order_parts_v8 a join public.bookings b on b.id=a.booking_id where a.project_id=pid and b.status<>'confirmed') then raise exception 'cash_not_confirmed';end if;\n`;
 if(c.name==='recording')sql+=`r:=public.prepare_service_balance_v8((select id from public.service_order_parts_v8 where project_id=pid));qid:=(r->>'id')::uuid;update public.service_quotes set stripe_session_id='cs_test_balance',status='open' where id=qid;begin perform public.receive_service_part_v8((select id from public.service_order_parts_v8 where project_id=pid),'balance');raise exception 'cash_card_race_allowed';exception when others then if sqlerrm<>'balance_checkout_open' then raise;end if;end;pay:=public.settle_service_cart_v8(qid,'cs_test_balance','pi_test_balance',1999,'eur',false,'evt_balance',now());if (select paid_cents<>total_cents from public.service_order_parts_v8 where project_id=pid) then raise exception 'balance_not_received';end if;if public.settle_service_cart_v8(qid,'cs_test_balance','pi_test_balance',1999,'eur',false,'evt_balance',now())<>pay then raise exception 'duplicate_balance';end if;\n`;
 if(c.name==='hours')sql+=`perform public.schedule_service_credit_v8((select id from public.service_order_parts_v8 where project_id=pid),'2026-11-20T18:30:00Z',150);perform public.schedule_service_credit_v8((select id from public.service_order_parts_v8 where project_id=pid),'2026-11-20T21:00:00Z',150);begin perform public.schedule_service_credit_v8((select id from public.service_order_parts_v8 where project_id=pid),'2026-11-21T10:00:00Z',15);raise exception 'third_credit_booking_allowed';exception when others then if sqlerrm<>'credit_exhausted' then raise;end if;end;\n`;
 sql+=`end $qa$;\nrollback to savepoint qa_${i};\n`;
}
fs.writeFileSync('supabase/operations/service_commerce_v8_test.sql',sql);
fs.writeFileSync('scripts/service-v8-fixtures.json',JSON.stringify(cases.map(c=>({name:c.name,quote:quoteOrder(c.items,true)})),null,2));
console.log('Prepared '+cases.length+' transaction-rollback cases.');

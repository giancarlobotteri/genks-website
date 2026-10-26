begin;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
savepoint cash;
do $qa$ declare r jsonb; p uuid; a public.service_order_parts_v8; pay uuid; begin
r:=public.reserve_service_cart_v8('{"name": "QA amministratore", "email": "qa-admin@example.invalid", "phone": "000000000", "accepted": "on", "earlyStart": true, "withdrawalAcknowledged": true}'::jsonb,'{"version": "2026-10-26-commerce-v8", "parts": [{"selection": {"kind": "recording", "songs": [], "hours": 2, "extraHours": 0, "date": "2026-11-20", "time": "19:30", "payment": "cash", "notes": "Solo collaudo annullato", "rights": "own"}, "title": "Registrazione in studio", "total": 3998, "listTotal": 3998, "saving": 0, "deposit": 1999, "dueNow": 1999, "cardNow": 0, "cashNow": 1999, "balance": 1999, "studioAmount": 3998, "customAmount": 0, "hours": 2, "guarantees": [], "lines": [{"name": "Registrazione · 2 ore × 19,99 €/ora", "amount": 3998}], "firstVersion": null}], "total": 3998, "cardNow": 0, "cashNow": 1999, "balance": 1999, "saving": 0, "requestId": "qa-admin-20261026-acconto"}'::jsonb,repeat('Condizioni QA ',20),'QA admin rollback');
p:=(r->>'project_id')::uuid;
select * into strict a from public.service_order_parts_v8 where project_id=p;
if a.initial_cents<>1999 or a.balance_cents<>1999 then raise exception 'wrong_advance';end if;
pay:=public.receive_service_part_v8(a.id,'initial');
if not exists(select 1 from public.bookings where id=a.booking_id and status='confirmed') then raise exception 'cash_advance_not_confirmed';end if;
if (select amount_cents from public.payments where id=pay)<>1999 then raise exception 'wrong_cash_ledger';end if;
begin perform public.receive_service_part_v8(a.id,'initial');raise exception 'duplicate_initial_allowed';exception when others then if sqlerrm<>'already_paid' then raise;end if;end;
pay:=public.receive_service_part_v8(a.id,'balance');
if (select sum(amount_cents) from public.payments where project_id=p)<>3998 then raise exception 'duplicate_or_missing_cash';end if;
begin perform public.receive_service_part_v8(a.id,'balance');raise exception 'duplicate_balance_allowed';exception when others then if sqlerrm<>'invalid_balance' then raise;end if;end;
if (select count(*) from public.notification_outbox where dedupe_key in ('cash-v8-'||a.id||'-initial','cash-v8-'||a.id||'-balance'))<>2 then raise exception 'cash_receipt_missing';end if;
end $qa$;
rollback to savepoint cash;
savepoint custom;
do $qa$ declare p uuid; q uuid; paid uuid; begin
insert into public.service_projects(name,email,track_title,service,track_count,description,notes,status,price_cents,commerce_snapshot)
values('QA amministratore','qa-admin@example.invalid','Pagamento personalizzato','studio_package',1,'Solo prova annullata','Solo prova annullata','awaiting_payment',1234,'{"version":"2026-10-26-commerce-v8","stage":"custom"}') returning id into p;
insert into public.service_quotes(project_id,amount_cents,scope,revision_count,expires_at,fixed_price,commerce_snapshot,stripe_session_id,status)
values(p,1234,'Solo prova annullata',0,now()+interval '23 hours',true,'{"version":"2026-10-26-commerce-v8","stage":"custom"}','cs_test_admin_custom','open') returning id into q;
begin perform public.settle_service_cart_v8(q,'cs_test_admin_custom','pi_admin_custom',1235,'eur',false,'evt_admin_custom',now());raise exception 'wrong_amount_allowed';exception when others then if sqlerrm<>'payment_mismatch' then raise;end if;end;
begin perform public.settle_service_cart_v8(q,'cs_test_wrong_session','pi_admin_custom',1234,'eur',false,'evt_admin_custom',now());raise exception 'wrong_session_allowed';exception when others then if sqlerrm<>'payment_mismatch' then raise;end if;end;
begin perform public.settle_service_cart_v8(q,'cs_test_admin_custom','pi_admin_custom',1234,'usd',false,'evt_admin_custom',now());raise exception 'wrong_currency_allowed';exception when others then if sqlerrm<>'payment_mismatch' then raise;end if;end;
paid:=public.settle_service_cart_v8(q,'cs_test_admin_custom','pi_admin_custom',1234,'eur',false,'evt_admin_custom',now());
if (select status from public.service_projects where id=p)<>'paid' then raise exception 'custom_not_paid';end if;
if public.settle_service_cart_v8(q,'cs_test_admin_custom','pi_admin_custom',1234,'eur',false,'evt_admin_custom',now())<>paid then raise exception 'custom_duplicate';end if;
if (select sum(amount_cents) from public.payments where project_id=p)<>1234 then raise exception 'custom_ledger';end if;
if not exists(select 1 from public.notification_outbox where dedupe_key='payment-'||paid) then raise exception 'custom_receipt_missing';end if;
end $qa$;
rollback to savepoint custom;
select 'acconti/saldi contanti, duplicati, importo/sessione/valuta, pagamento personalizzato e ricevute: OK' as result;
rollback;

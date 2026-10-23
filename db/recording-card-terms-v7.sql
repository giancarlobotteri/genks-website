create or replace function public.reserve_recording_checkout_v7(p_data jsonb,p_summary text)
returns jsonb language plpgsql set search_path='' as $$
declare ref text; b public.bookings; q public.service_quotes;
begin
 if coalesce(auth.role(),'')<>'service_role' or p_data->>'payment' is distinct from 'card' then raise exception 'server_only'; end if;
 -- Reuse the validated price, availability trigger, exclusion constraint and request limits atomically.
 if (p_data->>'startsAt')::timestamptz <= now()+interval '35 minutes' then raise exception 'booking_too_close'; end if;
 ref:=public.reserve_cash_service_v5('booking',p_data,'prod.genks@gmail.com');
 select * into strict b from public.bookings where reference=ref for update;
 update public.bookings set status='approved_awaiting_payment',hold_expires_at=now()+interval '35 minutes' where id=b.id;
 -- No cash receipt or confirmed appointment may leave this transaction before payment.
 delete from public.studio_cash_agreements where booking_id=b.id and received_at is null;
 update public.notification_outbox set cancelled_at=now() where sent_at is null and (dedupe_key='reservation-'||ref||'-admin' or dedupe_key like 'cash-agree-%' and body like '%'||ref||'%');
 insert into public.service_quotes(booking_id,amount_cents,scope,revision_count,expires_at,fixed_price,commerce_snapshot)
 values(b.id,b.price_cents,p_summary,0,now()+interval '31 minutes',true,jsonb_build_object('type','recording','rateVersion',p_data->>'rateVersion','acceptedAt',now(),'termsVersion','2026-10-23-recording-card-v7','terms',p_data->>'bookingTerms','startsAt',b.starts_at,'endsAt',b.ends_at,'totalCents',b.price_cents,'payment','card')) returning * into q;
 return to_jsonb(q)||jsonb_build_object('reference',ref);
end $$;
revoke all on function public.reserve_recording_checkout_v7(jsonb,text) from public,anon,authenticated;
grant execute on function public.reserve_recording_checkout_v7(jsonb,text) to service_role;

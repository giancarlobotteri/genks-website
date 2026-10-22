-- New recording reservations only; never rewrite saved agreements or receipts.
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('public.reserve_cash_service(text,jsonb,text)'::regprocedure);
 definition:=replace(definition,'2026-10-20-v2','2026-10-22-recording-v3');
 definition:=replace(definition,'rate<>2000','rate<>1999');
 execute definition;
 update public.booking_services set base_price_cents=1999 where code='recording';
end $migration$;

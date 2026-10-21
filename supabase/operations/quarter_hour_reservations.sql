begin;
do $patch$
declare definition text;
begin
 definition:=pg_get_functiondef('public.reserve_cash_service(text,jsonb,text)'::regprocedure);
 if position('hours integer;' in definition)=0 or position('if hours not in(1,2,3,4,6,8)' in definition)=0 then raise exception 'Reservation definition changed: review before patching'; end if;
 definition:=replace(definition,'hours integer;','hours numeric;');
 definition:=replace(definition,'hours:=(p_data->>''duration'')::integer;','hours:=(p_data->>''duration'')::numeric;');
 definition:=replace(definition,'if hours not in(1,2,3,4,6,8) then','if hours is null or hours<0.25 or hours>8 or mod(hours*60,15)<>0 then');
 definition:=replace(definition,'amount:=rate*hours;','amount:=round(rate*hours)::integer;');
 definition:=replace(definition,'make_interval(hours=>hours)','make_interval(mins=>(hours*60)::integer)');
 execute definition;
end $patch$;
commit;

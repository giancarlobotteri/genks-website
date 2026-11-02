-- Owner-requested removal of optional conversion monitoring.
-- No changes to orders, customers, bookings or payments.
drop function if exists public.genks_funnel_reconcile();
drop function if exists public.genks_funnel_report(date,date,text,text);
drop function if exists public.genks_funnel_record(uuid,text,text,text,uuid);
drop table if exists public.genks_funnel_events;

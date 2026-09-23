revoke all on function public.validate_booking_availability() from public, anon, authenticated;
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;

create index if not exists bookings_customer_idx on public.bookings(customer_id, starts_at desc);
create index if not exists bookings_service_idx on public.bookings(service_id);
create index if not exists booking_history_booking_idx on public.booking_status_history(booking_id, created_at desc);
create index if not exists projects_customer_idx on public.service_projects(customer_id, created_at desc);
create index if not exists project_files_project_idx on public.project_files(project_id, created_at desc);
create index if not exists project_history_project_idx on public.project_status_history(project_id, created_at desc);
create index if not exists payments_order_idx on public.payments(order_id);
create index if not exists payments_booking_idx on public.payments(booking_id);
create index if not exists payments_project_idx on public.payments(project_id);
create index if not exists exclusive_beat_idx on public.exclusive_requests(beat_id, created_at desc);
create index if not exists order_items_beat_idx on public.order_items(beat_id);
create index if not exists downloads_entitlement_idx on public.download_events(entitlement_id, created_at desc);
create index if not exists promo_redemptions_order_idx on public.promo_redemptions(order_id);

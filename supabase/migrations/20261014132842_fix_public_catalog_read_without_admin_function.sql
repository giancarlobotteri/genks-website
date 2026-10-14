-- Mirrors the migration already applied through Supabase.
-- Public catalog reads must not invoke the administrator-only function.
-- Authenticated administrators retain their separate ALL policies.
alter policy "public reads published beats" on public.beats using (status = 'published');
alter policy "public reads active beat prices" on public.beat_license_prices using (active);
alter policy "public reads active licenses" on public.license_types using (active);

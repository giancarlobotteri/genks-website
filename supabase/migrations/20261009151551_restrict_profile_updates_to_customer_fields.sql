-- Keep customer-editable profile data separate from authorization fields.
revoke update on public.profiles from authenticated;
grant update(display_name, phone, artist_name, marketing_consent) on public.profiles to authenticated;

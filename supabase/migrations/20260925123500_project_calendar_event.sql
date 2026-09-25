alter table public.service_projects
  add column if not exists google_calendar_event_id text;

create index if not exists service_projects_google_calendar_event_idx
  on public.service_projects(google_calendar_event_id)
  where google_calendar_event_id is not null;

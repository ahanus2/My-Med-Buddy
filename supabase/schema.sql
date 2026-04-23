create table if not exists public.patient_dashboards (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_patient_dashboards_updated_at on public.patient_dashboards;
create trigger set_patient_dashboards_updated_at
before update on public.patient_dashboards
for each row
execute procedure public.set_updated_at();

alter table public.patient_dashboards enable row level security;

drop policy if exists "Users can view their own dashboard" on public.patient_dashboards;
create policy "Users can view their own dashboard"
on public.patient_dashboards
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own dashboard" on public.patient_dashboards;
create policy "Users can insert their own dashboard"
on public.patient_dashboards
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own dashboard" on public.patient_dashboards;
create policy "Users can update their own dashboard"
on public.patient_dashboards
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

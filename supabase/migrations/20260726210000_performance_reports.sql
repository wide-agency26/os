-- Migration: performance_reports table for the WIDE OS 13-step reporting engine
-- Stores raw API input payloads and AI-generated report output per client per period.

create table if not exists public.performance_reports (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.profiles(id) on delete cascade,
  workspace_id    uuid references public.workspaces(id) on delete set null,
  report_period_start date not null,
  report_period_end   date not null,
  package_tier    text not null default 'launch'
                  check (package_tier in ('mvb','launch','growth','full_partnership')),
  input_payload   jsonb not null default '{}'::jsonb,
  generated_report jsonb,
  status          text not null default 'draft'
                  check (status in ('draft','generating','published','failed')),
  generated_at    timestamptz,
  published_at    timestamptz,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Index for client lookups
create index if not exists idx_perf_reports_client
  on public.performance_reports(client_id, report_period_start desc);

-- RLS
alter table public.performance_reports enable row level security;

-- Founders (superadmin + all staff roles) can do everything
create policy "founders_full_access" on public.performance_reports
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('superadmin','admin','client_manager','accountant','bd_manager','hr_manager')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('superadmin','admin','client_manager','accountant','bd_manager','hr_manager')
    )
  );

-- Clients can only read their own published reports
create policy "clients_read_published" on public.performance_reports
  for select
  using (
    client_id = auth.uid()
    and status = 'published'
  );

-- updated_at trigger
create or replace function public.set_performance_report_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_performance_reports_updated_at
  before update on public.performance_reports
  for each row execute function public.set_performance_report_updated_at();

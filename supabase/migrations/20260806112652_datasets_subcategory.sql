-- Tag datasets by platform / export stream (e.g. linkedin_posts, meta_ads)
alter table public.datasets
  add column if not exists subcategory text;

comment on column public.datasets.subcategory is
  'Optional platform/stream tag: meta_ads, linkedin_metrics, linkedin_posts, ga4, etc.';

create index if not exists datasets_project_category_sub_idx
  on public.datasets (project_id, category, subcategory);

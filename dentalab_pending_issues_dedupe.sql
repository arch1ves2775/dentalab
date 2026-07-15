-- DentaLab: garante apenas um aviso aberto por caso, tipo e alvo.
-- Execute uma vez no Supabase SQL Editor.

alter table public.pending_issues add column if not exists target text;

-- Preserva o aviso aberto mais antigo e encerra duplicados preexistentes.
with ranked as (
  select id,
         row_number() over (
           partition by case_id, type, coalesce(target, '')
           order by created_at asc, id asc
         ) as duplicate_number
  from public.pending_issues
  where status = 'open'
)
update public.pending_issues
set status = 'resolved', resolved_at = coalesce(resolved_at, now())
where id in (select id from ranked where duplicate_number > 1);

create unique index if not exists pending_issues_one_open_request
on public.pending_issues (case_id, type, coalesce(target, ''))
where status = 'open';

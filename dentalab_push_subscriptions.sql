-- DentaLab: registo seguro de Web Push por utilizador/dispositivo.
-- Execute este ficheiro uma vez no Supabase SQL Editor.

alter table public.push_subscriptions enable row level security;

-- Remove políticas antigas/conflitantes desta tabela e recria uma base mínima.
do $$
declare policy_row record;
begin
  for policy_row in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'push_subscriptions'
  loop
    execute format('drop policy if exists %I on public.push_subscriptions', policy_row.policyname);
  end loop;
end $$;

create policy "push_select_own"
on public.push_subscriptions for select
to authenticated
using (user_id = auth.uid());

create policy "push_insert_own"
on public.push_subscriptions for insert
to authenticated
with check (user_id = auth.uid());

create policy "push_update_own"
on public.push_subscriptions for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "push_delete_own"
on public.push_subscriptions for delete
to authenticated
using (user_id = auth.uid());

create unique index if not exists push_subscriptions_endpoint_key
on public.push_subscriptions (endpoint);

-- Um endpoint pertence ao navegador, não permanentemente à primeira conta
-- usada nele. Esta função permite que a conta atualmente autenticada assuma
-- o seu próprio endpoint sem ganhar acesso às restantes inscrições.
create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text,
  p_subscription jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'authentication required';
  end if;
  if coalesce(p_endpoint, '') = '' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'invalid push subscription';
  end if;

  insert into public.push_subscriptions
    (user_id, endpoint, p256dh, auth, user_agent, subscription, updated_at)
  values
    (current_user_id, p_endpoint, p_p256dh, p_auth, coalesce(p_user_agent, ''), coalesce(p_subscription, '{}'::jsonb), now())
  on conflict (endpoint) do update set
    user_id = current_user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    subscription = excluded.subscription,
    updated_at = now();
end;
$$;

revoke all on function public.register_push_subscription(text, text, text, text, jsonb) from public;
grant execute on function public.register_push_subscription(text, text, text, text, jsonb) to authenticated;

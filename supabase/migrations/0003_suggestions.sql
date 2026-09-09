-- "Indique seu jogo": membros sugerem, admin aceita/recusa.

create table public.suggestions (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 1 and 120),
  note         text check (char_length(note) <= 500),
  suggested_by uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pendente' check (status in ('pendente','aceita','recusada')),
  admin_note   text check (char_length(admin_note) <= 300),
  created_at   timestamptz not null default now(),
  decided_at   timestamptz
);
alter table public.suggestions enable row level security;

create policy suggestions_select_all on public.suggestions
  for select using (true);

create policy suggestions_insert_member on public.suggestions
  for insert to authenticated
  with check ((select auth.uid()) = suggested_by and public.is_member());

create policy suggestions_update_admin on public.suggestions
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy suggestions_delete_own_or_admin on public.suggestions
  for delete to authenticated
  using ((select auth.uid()) = suggested_by or public.is_admin());

grant select on public.suggestions to anon, authenticated;
grant insert, update, delete on public.suggestions to authenticated;

alter publication supabase_realtime add table public.suggestions;

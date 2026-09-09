-- Game Club Retrô — schema inicial
-- allowlist · profiles · games · rounds · reviews  +  RLS  +  helpers  +  realtime
-- Ordem: tabelas → funções → triggers → policies → grants → realtime

-- ========================================================================
-- 1. TABELAS
-- ========================================================================

-- allowlist: quem o admin autoriza a logar
create table public.allowlist (
  email      text primary key,
  role       text not null default 'membro' check (role in ('admin','membro')),
  created_at timestamptz not null default now()
);
alter table public.allowlist enable row level security;

-- profiles: criado no 1º login por trigger em auth.users
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text,
  created_at   timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- games
create table public.games (
  id            text primary key,
  title         text not null,
  console       text not null check (console in ('SNES','MD','N64','PS1','GBA','GBC')),
  year          int  not null,
  youtube_id    text,
  pitch         text,
  series        text,
  series_order  int,
  wiki_title    text,
  cover_url     text,
  critic_score  int  check (critic_score between 0 and 100),
  critic_source text check (critic_source in ('rawg','manual')),
  featured      boolean not null default false,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.games enable row level security;

-- rounds: um mês do clube (jogando → avaliando → arquivada)
create table public.rounds (
  id          uuid primary key default gen_random_uuid(),
  game_id     text not null references public.games(id),
  status      text not null default 'jogando' check (status in ('jogando','avaliando','arquivada')),
  drawn_at    timestamptz not null default now(),
  closed_at   timestamptz,
  archived_at timestamptz,
  drawn_by    uuid references public.profiles(id)
);
alter table public.rounds enable row level security;

-- reviews: nota 1–5 + crítica ≤280; 1 por membro por rodada
create table public.reviews (
  id         uuid primary key default gen_random_uuid(),
  round_id   uuid not null references public.rounds(id) on delete cascade,
  member_id  uuid not null references public.profiles(id) on delete cascade,
  rating     int  not null check (rating between 1 and 5),
  body       text check (char_length(body) <= 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, member_id)
);
alter table public.reviews enable row level security;

-- ========================================================================
-- 2. FUNÇÕES (helpers de autorização revelam só um booleano sobre o chamador)
-- ========================================================================

create function public.is_member()
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.profiles p
    join public.allowlist a on lower(a.email) = lower(p.email)
    where p.id = (select auth.uid())
  );
$$;

create function public.is_admin()
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.profiles p
    join public.allowlist a on lower(a.email) = lower(p.email)
    where p.id = (select auth.uid()) and a.role = 'admin'
  );
$$;

create function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;

-- profile no 1º login
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Auth hook (a função é criada aqui; REGISTRAR o hook é passo de dashboard/Management API)
create function public.hook_before_user_created(event jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(event->'user'->>'email');
begin
  if exists (select 1 from public.allowlist where lower(email) = v_email) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'message', 'Esse e-mail não está na lista de membros do Game Club Retrô. Peça acesso ao admin.',
    'http_code', 403
  ));
end;
$$;
grant execute on function public.hook_before_user_created to supabase_auth_admin;
revoke execute on function public.hook_before_user_created from authenticated, anon, public;

-- no máximo UMA rodada não-arquivada
create function public.enforce_single_active_round()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status <> 'arquivada'
     and exists (select 1 from public.rounds where id <> new.id and status <> 'arquivada') then
    raise exception 'Já existe uma rodada ativa. Arquive-a antes de sortear a próxima.';
  end if;
  return new;
end;
$$;

-- ========================================================================
-- 3. TRIGGERS
-- ========================================================================
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger games_touch before update on public.games
  for each row execute function public.touch_updated_at();

create trigger reviews_touch before update on public.reviews
  for each row execute function public.touch_updated_at();

create trigger rounds_single_active
  before insert or update on public.rounds
  for each row execute function public.enforce_single_active_round();

-- ========================================================================
-- 4. POLICIES
-- ========================================================================

create policy allowlist_admin_all on public.allowlist
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy profiles_select_all on public.profiles for select using (true);
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy games_select_all on public.games for select using (true);
create policy games_admin_write on public.games
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy rounds_select_all on public.rounds for select using (true);
create policy rounds_admin_write on public.rounds
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy reviews_select_all on public.reviews for select using (true);
create policy reviews_insert_own on public.reviews
  for insert to authenticated
  with check (
    (select auth.uid()) = member_id
    and public.is_member()
    and exists (select 1 from public.rounds r where r.id = round_id and r.status = 'avaliando')
  );
create policy reviews_update_own on public.reviews
  for update to authenticated
  using ((select auth.uid()) = member_id)
  with check (
    (select auth.uid()) = member_id
    and exists (select 1 from public.rounds r where r.id = round_id and r.status = 'avaliando')
  );
create policy reviews_delete_own on public.reviews
  for delete to authenticated
  using ((select auth.uid()) = member_id);

-- ========================================================================
-- 5. GRANTS p/ Data API (RLS continua sendo o portão de linhas)
-- ========================================================================
grant usage on schema public to anon, authenticated;
grant select on public.games, public.rounds, public.reviews, public.profiles to anon, authenticated;
grant insert, update, delete on public.games, public.rounds, public.allowlist to authenticated;
grant insert, update, delete on public.reviews to authenticated;
grant update on public.profiles to authenticated;
grant execute on function public.is_admin(), public.is_member() to anon, authenticated;

-- ========================================================================
-- 6. REALTIME
-- ========================================================================
alter publication supabase_realtime add table public.rounds;
alter publication supabase_realtime add table public.reviews;
alter publication supabase_realtime add table public.games;

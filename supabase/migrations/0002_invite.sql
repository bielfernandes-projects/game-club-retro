-- Código de convite: o admin compartilha 1 link, os membros se cadastram sozinhos.

create table public.club_config (
  key   text primary key,
  value text not null
);
alter table public.club_config enable row level security;

-- só o admin lê/edita a config pela Data API (o RPC abaixo lê via security definer)
create policy club_config_admin on public.club_config
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into public.club_config (key, value)
values ('invite_code', substr(md5(random()::text), 1, 8));

-- Redime um convite: se o código bate, entra na allowlist como membro.
-- Chamado pelo cliente (anon) ANTES do signInWithOtp.
create function public.redeem_invite(p_email text, p_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_code text;
begin
  select value into v_code from public.club_config where key = 'invite_code';
  if v_code is null or v_code = '' or lower(trim(p_code)) <> lower(v_code) then
    return false;
  end if;
  insert into public.allowlist (email, role)
  values (lower(trim(p_email)), 'membro')
  on conflict (email) do nothing;
  return true;
end;
$$;

revoke execute on function public.redeem_invite(text, text) from public;
grant execute on function public.redeem_invite(text, text) to anon, authenticated;

grant select, insert, update, delete on public.club_config to authenticated;

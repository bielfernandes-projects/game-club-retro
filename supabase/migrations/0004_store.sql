-- "Loja": consoles/acessórios retrô à venda. Um cron diário (api/store-refresh) busca,
-- pra cada `keyword`, a oferta de MAIOR comissão na Shopee Affiliate API e preenche a linha
-- (subId "gameclub"). O admin gerencia a lista (keyword/label/ordem/ativo) e pode forçar a
-- busca. Leitura pública, escrita só admin (= games). Idempotente.

drop table if exists public.store_items cascade;

create table public.store_items (
  id           uuid primary key default gen_random_uuid(),
  label        text not null check (char_length(label) between 1 and 120),
  keyword      text check (char_length(keyword) <= 200),  -- termo de busca; null = item manual
  url          text check (url is null or (url ~* '^https?://' and char_length(url) <= 2000)),
  title        text check (char_length(title) <= 300),    -- nome cru do produto na Shopee
  image_url    text check (char_length(image_url) <= 2000),
  price        text check (char_length(price) <= 60),
  rating       numeric check (rating >= 0 and rating <= 5),
  sales        int check (sales >= 0),
  commission   numeric check (commission >= 0),            -- % de comissão da oferta escolhida
  item_id      bigint,
  shop_id      bigint,
  sort_order   int not null default 0,
  active       boolean not null default true,
  refreshed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.store_items enable row level security;

create unique index store_items_keyword_key on public.store_items (keyword) where keyword is not null;

create trigger store_items_touch before update on public.store_items
  for each row execute function public.touch_updated_at();

create policy store_items_select_all on public.store_items
  for select using (true);

create policy store_items_admin_write on public.store_items
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select on public.store_items to anon, authenticated;
grant insert, update, delete on public.store_items to authenticated;

alter publication supabase_realtime add table public.store_items;

-- lista fixa que o clube quer manter (o cron preenche os dados)
insert into public.store_items (label, keyword, sort_order) values
  ('Console R36S',                         'Console R36S',                            0),
  ('Console R36H',                         'Console R36H',                            1),
  ('Grip de Mão para R36S',                'Grip de Mão para R36S',                   2),
  ('Bolsa de Armazenamento para R36S',     'Bolsa de Armazenamento para R36S',        3),
  ('Grip de Polegar para R36S',            'Grip Polegar para R36S',                  4),
  ('Game Stick M15',                       'Game Stick M15',                          5),
  ('Pendrive 2 em 1 + Cartão de Memória',  'Pendrive 2 em 1 Leitor USB Cartão de Memória Multilaser', 6)
on conflict (keyword) where keyword is not null do nothing;

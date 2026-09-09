-- Loja vira CRUD 100% manual: fora a integração com a Shopee Affiliate API.
-- Sobram: label, url (link de afiliado), image_url, price, rating, sales, sort_order, active.

drop index if exists public.store_items_keyword_key;

alter table public.store_items
  drop column if exists keyword,
  drop column if exists title,
  drop column if exists commission,
  drop column if exists item_id,
  drop column if exists shop_id,
  drop column if exists refreshed_at;

-- alinha o check de image_url com o de url (tem que ser http/https)
alter table public.store_items drop constraint if exists store_items_image_url_check;
alter table public.store_items add constraint store_items_image_url_check
  check (image_url is null or (image_url ~* '^https?://' and char_length(image_url) <= 2000));

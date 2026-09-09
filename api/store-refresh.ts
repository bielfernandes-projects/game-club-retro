import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { hasCreds, bestOfferByKeyword } from "./_shopee";

/**
 * Cron diário (ver vercel.json). Pra cada linha ativa de `store_items` com `keyword`,
 * busca a oferta de MAIOR comissão na Shopee e atualiza a linha.
 *
 * Não-destrutivo: se a busca do dia não achar nada, a linha fica como estava (mantém o
 * link/foto/preço do último dia que achou). Os 7 itens da lista nunca somem.
 */
export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  if (!hasCreds()) {
    res.status(500).json({ error: "SHOPEE_APP_ID/SECRET não configurados" });
    return;
  }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    res.status(500).json({ error: "SUPABASE_URL/SERVICE_ROLE_KEY não configurados" });
    return;
  }

  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: rows, error } = await db
    .from("store_items")
    .select("id, label, keyword")
    .eq("active", true)
    .not("keyword", "is", null);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  const updated: string[] = [];
  const kept: string[] = [];

  for (const row of rows ?? []) {
    let offer = null;
    try {
      offer = await bestOfferByKeyword(row.keyword as string);
    } catch {
      offer = null;
    }
    if (!offer || !offer.link) {
      kept.push(row.label as string);
      continue;
    }
    const patch: Record<string, unknown> = { refreshed_at: new Date().toISOString() };
    if (offer.link) patch.url = offer.link;
    if (offer.image) patch.image_url = offer.image;
    if (offer.title) patch.title = offer.title;
    if (offer.price) patch.price = offer.price;
    if (offer.rating != null) patch.rating = offer.rating;
    if (offer.sales != null) patch.sales = offer.sales;
    if (offer.commission != null) patch.commission = offer.commission;
    if (offer.item_id != null) patch.item_id = offer.item_id;
    if (offer.shop_id != null) patch.shop_id = offer.shop_id;
    const { error: upErr } = await db.from("store_items").update(patch).eq("id", row.id);
    if (upErr) kept.push(`${row.label} (erro: ${upErr.message})`);
    else updated.push(row.label as string);
  }

  res.status(200).json({ ok: true, updated, kept, at: new Date().toISOString() });
}

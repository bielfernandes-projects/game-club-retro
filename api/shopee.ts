import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  hasCreds, parseIds, resolveUrl, bestOfferByKeyword, offerByIds, type ShopeeOffer,
} from "../lib/shopee.js";

/**
 * Busca sob demanda (usada pelo painel admin):
 *   GET /api/shopee?keyword=<termo>        → oferta de maior comissão pro termo
 *   GET /api/shopee?url=<encoded>          → oferta daquele produto (resolve short link)
 *   GET /api/shopee?itemId=<n>&shopId=<n>  → oferta daquele produto (re-buscar)
 * → { image, title, price, link, rating, sales, commission, item_id, shop_id }  (null onde não achou)
 *
 * Best-effort: qualquer falha vira campos null, nunca 5xx (500 só sem credenciais).
 */
const EMPTY: ShopeeOffer = {
  image: null, title: null, price: null, link: null,
  rating: null, sales: null, commission: null, item_id: null, shop_id: null,
};

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!hasCreds()) {
    res.status(500).json({ ...EMPTY, error: "SHOPEE_APP_ID/SECRET não configurados" });
    return;
  }
  const q = req.query;
  const keyword = typeof q.keyword === "string" ? q.keyword.trim() : "";
  const rawUrl = typeof q.url === "string" ? q.url : "";
  let itemId = typeof q.itemId === "string" ? Number(q.itemId) : NaN;
  let shopId = typeof q.shopId === "string" ? Number(q.shopId) : NaN;

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12_000);
  try {
    let offer: ShopeeOffer | null = null;

    if (keyword) {
      offer = await bestOfferByKeyword(keyword, ctl.signal);
    } else if (Number.isFinite(itemId) && Number.isFinite(shopId)) {
      offer = await offerByIds(itemId, shopId, ctl.signal);
    } else if (rawUrl && isHttpUrl(rawUrl)) {
      const finalUrl = /^https:\/\/s\.shopee\./i.test(rawUrl)
        ? await resolveUrl(rawUrl, ctl.signal)
        : rawUrl;
      const ids = parseIds(finalUrl);
      if (!ids) {
        res.status(200).json({ ...EMPTY, error: "não consegui extrair itemId/shopId da URL" });
        return;
      }
      itemId = ids.itemId;
      shopId = ids.shopId;
      offer = await offerByIds(itemId, shopId, ctl.signal);
    } else {
      res.status(400).json({ ...EMPTY, error: "informe keyword, url ou itemId+shopId" });
      return;
    }

    res.setHeader("cache-control", "public, s-maxage=3600");
    res.status(200).json(
      offer ?? {
        ...EMPTY,
        item_id: Number.isFinite(itemId) ? itemId : null,
        shop_id: Number.isFinite(shopId) ? shopId : null,
      },
    );
  } catch {
    res.setHeader("cache-control", "public, s-maxage=60");
    res.status(200).json(EMPTY);
  } finally {
    clearTimeout(timer);
  }
}

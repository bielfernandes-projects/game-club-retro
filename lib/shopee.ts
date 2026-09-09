import { createHash } from "node:crypto";

/**
 * Helpers da Shopee Affiliate Open Platform (GraphQL).
 * Fora de `api/` (senão o Vercel roteia) e importado como `../lib/shopee.js` (extensão .js
 * explícita — necessária no ESM). Credenciais só no servidor: SHOPEE_APP_ID / SHOPEE_APP_SECRET.
 */
const ENDPOINT = "https://open-api.affiliate.shopee.com.br/graphql";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/125.0 Safari/537.36";

type Json = Record<string, unknown>;

export interface ShopeeOffer {
  image: string | null;
  title: string | null;
  price: string | null;
  link: string | null;
  rating: number | null;
  sales: number | null;
  commission: number | null;
  item_id: number | null;
  shop_id: number | null;
}

export function hasCreds(): boolean {
  return !!(process.env.SHOPEE_APP_ID && process.env.SHOPEE_APP_SECRET);
}

async function gql(query: string, signal?: AbortSignal): Promise<Json | null> {
  const appId = process.env.SHOPEE_APP_ID as string;
  const secret = process.env.SHOPEE_APP_SECRET as string;
  const body = JSON.stringify({ query });
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHash("sha256").update(appId + ts + body + secret).digest("hex");
  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        "user-agent": UA,
        authorization: `SHA256 Credential=${appId}, Timestamp=${ts}, Signature=${sig}`,
      },
      body,
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { data?: Json; errors?: unknown };
    if (j.errors || !j.data) return null;
    return j.data;
  } catch {
    return null;
  }
}

const NODE_FIELDS =
  "itemId shopId productName imageUrl priceMin priceMax price offerLink productLink ratingStar sales commissionRate";

function num(v: unknown): number | null {
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function priceLabel(min: unknown, max: unknown): string | null {
  const fmt = (x: number) => `R$ ${x.toFixed(2).replace(".", ",")}`;
  const lo = num(min);
  const hi = num(max);
  if (lo && hi && hi > lo) return `${fmt(lo)} – ${fmt(hi)}`;
  if (lo && lo > 0) return fmt(lo);
  if (hi && hi > 0) return fmt(hi);
  return null;
}

export function parseIds(u: string): { itemId: number; shopId: number } | null {
  let m = /\/product\/(\d+)\/(\d+)/.exec(u);
  if (m) return { shopId: Number(m[1]), itemId: Number(m[2]) };
  m = /-i\.(\d+)\.(\d+)/.exec(u);
  if (m) return { shopId: Number(m[1]), itemId: Number(m[2]) };
  return null;
}

export async function resolveUrl(u: string, signal?: AbortSignal): Promise<string> {
  try {
    const r = await fetch(u, { redirect: "follow", signal, headers: { "user-agent": UA } });
    return r.url || u;
  } catch {
    return u;
  }
}

async function shortLink(originUrl: string, signal?: AbortSignal): Promise<string> {
  const esc = originUrl.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const d = await gql(
    `mutation { generateShortLink(input: { originUrl: "${esc}", subIds: ["gameclub"] }) { shortLink } }`,
    signal,
  );
  const s = (d?.generateShortLink as { shortLink?: string } | undefined)?.shortLink;
  return s || originUrl;
}

async function nodeToOffer(node: Json, signal?: AbortSignal): Promise<ShopeeOffer> {
  const shopId = num(node.shopId);
  const itemId = num(node.itemId);
  const origin =
    (node.offerLink as string) ||
    (node.productLink as string) ||
    (shopId && itemId ? `https://shopee.com.br/product/${shopId}/${itemId}` : "");
  const link = origin ? await shortLink(origin, signal) : null;
  const rating = num(node.ratingStar);
  const sales = num(node.sales);
  const commission = num(node.commissionRate);
  return {
    image: (node.imageUrl as string) || null,
    title: (node.productName as string) || null,
    price: priceLabel(node.priceMin, node.priceMax) || priceLabel(node.price, null),
    link,
    rating: rating != null && rating > 0 ? rating : null,
    sales: sales != null && sales >= 0 ? Math.round(sales) : null,
    commission: commission != null ? (commission <= 1 ? commission * 100 : commission) : null,
    item_id: itemId,
    shop_id: shopId,
  };
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const STOP = new Set(["de", "da", "do", "para", "com", "e", "em", "a", "o", "os", "as", "leitor", "usb", "ou"]);
const ACCESSORY = [
  "grip", "capa", "case", "bolsa", "pelicula", "suporte", "carregador", "cabo",
  "adesivo", "skin", "protetor", "kit", "estojo", "silicone",
];

/**
 * Só ofertas que casam com o termo (código de modelo + ≥60% das palavras; descarta acessório
 * quando o termo pede console). Pega a mais relevante — melhor média de vendas × comissão que
 * "só a maior comissão". Nada casa → null.
 */
function pickForKeyword(nodes: Json[], keyword: string): Json | null {
  const tokens = norm(keyword).split(" ").filter((t) => t.length >= 2 && !STOP.has(t));
  const isModel = (t: string) => /[a-z]/.test(t) && /[0-9]/.test(t);
  const models = tokens.filter(isModel);
  const words = tokens.filter((t) => !isModel(t));
  const need = Math.ceil(words.length * 0.6);
  const banned = tokens.some((t) => ACCESSORY.includes(t)) ? [] : ACCESSORY;
  return (
    nodes.find((n) => {
      const name = norm(String(n.productName ?? ""));
      if (!models.every((m) => name.includes(m))) return false;
      if (banned.some((w) => name.includes(w))) return false;
      return words.filter((w) => name.includes(w)).length >= need;
    }) ?? null
  );
}

export async function bestOfferByKeyword(
  keyword: string,
  signal?: AbortSignal,
): Promise<ShopeeOffer | null> {
  const kw = keyword.replace(/["\\]/g, " ").trim();
  const d = await gql(
    `{ productOfferV2(keyword: "${kw}", limit: 50) { nodes { ${NODE_FIELDS} } } }`,
    signal,
  );
  const nodes = (d?.productOfferV2 as { nodes?: Json[] } | undefined)?.nodes ?? [];
  const best = pickForKeyword(nodes, keyword);
  return best ? nodeToOffer(best, signal) : null;
}

export async function offerByIds(
  itemId: number,
  shopId: number,
  signal?: AbortSignal,
): Promise<ShopeeOffer | null> {
  const d = await gql(
    `{ productOfferV2(itemId: ${itemId}, shopId: ${shopId}) { nodes { ${NODE_FIELDS} } } }`,
    signal,
  );
  const node = (d?.productOfferV2 as { nodes?: Json[] } | undefined)?.nodes?.[0];
  return node ? nodeToOffer(node, signal) : null;
}

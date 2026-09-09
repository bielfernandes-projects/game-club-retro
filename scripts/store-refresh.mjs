// Roda a mesma lógica do cron `api/store-refresh.ts` uma vez, na mão.
//   node --env-file=.env.local scripts/store-refresh.mjs
// Pra cada linha ativa de store_items com `keyword`, busca a oferta de MAIOR comissão
// na Shopee Affiliate API (subId "gameclub") e atualiza a linha. Não-destrutivo: se nada
// casar, mantém o que já estava.
import postgres from "postgres";
import { createHash } from "node:crypto";

const APP_ID = process.env.SHOPEE_APP_ID;
const SECRET = process.env.SHOPEE_APP_SECRET;
if (!APP_ID || !SECRET) {
  console.error("Faltou SHOPEE_APP_ID / SHOPEE_APP_SECRET no .env.local");
  process.exit(1);
}

const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { ssl: "require", max: 1, prepare: false });

async function gql(query) {
  const body = JSON.stringify({ query });
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHash("sha256").update(APP_ID + ts + body + SECRET).digest("hex");
  const r = await fetch("https://open-api.affiliate.shopee.com.br/graphql", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `SHA256 Credential=${APP_ID}, Timestamp=${ts}, Signature=${sig}`,
    },
    body,
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.errors ? null : j.data;
}

const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const STOP = new Set(["de", "da", "do", "para", "com", "e", "em", "a", "o", "os", "as", "leitor", "usb", "ou"]);
const ACCESSORY = ["grip", "capa", "case", "bolsa", "pelicula", "suporte", "carregador", "cabo", "adesivo", "skin", "protetor", "kit", "estojo", "silicone"];

function pick(nodes, keyword) {
  const tokens = norm(keyword).split(" ").filter((t) => t.length >= 2 && !STOP.has(t));
  const isM = (t) => /[a-z]/.test(t) && /[0-9]/.test(t);
  const models = tokens.filter(isM);
  const words = tokens.filter((t) => !isM(t));
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

async function shortLink(origin) {
  const esc = origin.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const d = await gql(`mutation { generateShortLink(input: { originUrl: "${esc}", subIds: ["gameclub"] }) { shortLink } }`);
  return d?.generateShortLink?.shortLink || origin;
}

const priceLabel = (min, max) => {
  const f = (x) => `R$ ${Number(x).toFixed(2).replace(".", ",")}`;
  const lo = Number(min), hi = Number(max);
  if (lo && hi && hi > lo) return `${f(lo)} – ${f(hi)}`;
  if (lo > 0) return f(lo);
  return null;
};

const rows = await sql`select id, label, keyword from store_items where active and keyword is not null order by sort_order`;
for (const row of rows) {
  const d = await gql(
    `{ productOfferV2(keyword: "${row.keyword}", limit: 50) { nodes { itemId shopId productName imageUrl priceMin priceMax price offerLink productLink ratingStar sales commissionRate } } }`,
  );
  const b = pick(d?.productOfferV2?.nodes ?? [], row.keyword);
  if (!b) { console.log(`  = ${row.label} — nada casou, mantido`); continue; }
  const origin = b.offerLink || b.productLink || `https://shopee.com.br/product/${b.shopId}/${b.itemId}`;
  const link = await shortLink(origin);
  const rate = Number(b.commissionRate);
  await sql`update store_items set
    url = ${link},
    title = ${b.productName ?? null},
    image_url = ${b.imageUrl ?? null},
    price = ${priceLabel(b.priceMin, b.priceMax) ?? null},
    rating = ${Number(b.ratingStar) || null},
    sales = ${Number(b.sales) || null},
    commission = ${rate <= 1 ? rate * 100 : rate},
    item_id = ${Number(b.itemId)},
    shop_id = ${Number(b.shopId)},
    refreshed_at = now()
    where id = ${row.id}`;
  console.log(`  ✓ ${row.label} — ${((rate <= 1 ? rate * 100 : rate)).toFixed(0)}% — ${priceLabel(b.priceMin, b.priceMax)} — ${link}`);
}

await sql.end();
console.log("\nok");

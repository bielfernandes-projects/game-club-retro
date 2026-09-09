// Resolve capa (Wikipédia) + nota de crítica (RAWG) de todos os jogos e grava no banco.
// Usa a função /api/enrich já deployada. Rode uma vez após o seed.
//   node --env-file=.env.local scripts/enrich-all.mjs
import postgres from "postgres";

const BASE = process.env.ENRICH_BASE || "https://gameclub.bf.dev.br";
const sql = postgres(process.env.POSTGRES_URL_NON_POOLING, { ssl: "require", max: 1, prepare: false });

const games = await sql`select id, title, wiki_title, critic_source from public.games order by id`;
let cov = 0, sco = 0, miss = [];

for (const g of games) {
  const p = new URLSearchParams();
  if (g.wiki_title) p.set("title", g.wiki_title);
  p.set("name", g.title);
  try {
    const r = await fetch(`${BASE}/api/enrich?${p}`);
    const d = await r.json();
    const patch = {};
    if (d.cover_url) { patch.cover_url = d.cover_url; cov++; }
    if (d.critic_score != null && g.critic_source !== "manual") {
      patch.critic_score = d.critic_score;
      patch.critic_source = "rawg";
      sco++;
    }
    if (Object.keys(patch).length) {
      await sql`update public.games set ${sql(patch)} where id = ${g.id}`;
    }
    if (!d.cover_url) miss.push(g.id + " (capa)");
    process.stdout.write(".");
  } catch (e) {
    miss.push(g.id + " ERR " + e.message);
    process.stdout.write("x");
  }
}

console.log(`\n\ncapas: ${cov}/${games.length}  ·  notas RAWG: ${sco}/${games.length}`);
if (miss.length) console.log("sem capa / erro:", miss.join(", "));
await sql.end();

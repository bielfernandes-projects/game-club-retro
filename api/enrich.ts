import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * GET /api/enrich?title=<wiki_title>&name=<nome do jogo>
 * → { cover_url, critic_score, critic_source }
 * Proxy só-leitura: capa da Wikipédia + nota Metacritic via RAWG (chave fica no servidor).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const title = typeof req.query.title === "string" ? req.query.title : "";
  const name = typeof req.query.name === "string" ? req.query.name : "";

  let cover_url: string | null = null;
  let critic_score: number | null = null;
  let critic_source: "rawg" | null = null;

  if (title) {
    try {
      const r = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`,
        { headers: { "user-agent": "game-club-retro/1.0 (enrich)" } },
      );
      if (r.ok) {
        const d = (await r.json()) as {
          originalimage?: { source?: string; width?: number };
          thumbnail?: { source?: string };
        };
        const oi = d.originalimage;
        cover_url =
          (oi?.width && oi.width <= 1200 ? oi.source ?? null : null) ||
          d.thumbnail?.source ||
          null;
      }
    } catch {
      /* ignora */
    }
  }

  const key = process.env.RAWG_API_KEY;
  if (key && name) {
    try {
      const r = await fetch(
        `https://api.rawg.io/api/games?key=${key}&search=${encodeURIComponent(name)}&page_size=1`,
      );
      if (r.ok) {
        const d = (await r.json()) as { results?: { metacritic?: number | null }[] };
        const m = d.results?.[0]?.metacritic;
        if (typeof m === "number" && m > 0) {
          critic_score = m;
          critic_source = "rawg";
        }
      }
    } catch {
      /* ignora */
    }
  }

  res.setHeader("cache-control", "public, s-maxage=86400");
  res.json({ cover_url, critic_score, critic_source });
}

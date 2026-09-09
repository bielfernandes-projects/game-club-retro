import type { Game, Round } from "./types";
import { EMU, consoleShort, romSearchUrl, ytPoster, ytWatch } from "./emu";
import { blockingPredecessor } from "./data/draw";

export const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

export function starsHtml(rating: number, max = 5): string {
  let out = '<span class="stars">';
  for (let i = 1; i <= max; i++) out += `<span class="s${i <= rating ? " on" : ""}">★</span>`;
  return out + "</span>";
}

/** Bloco de mídia (capa + trailer pôster + links emulador/ROM) de um jogo. */
export function gameMediaHtml(g: Game): string {
  const label = EMU[g.console].label;
  const cover = g.cover_url
    ? `<img src="${esc(g.cover_url)}" alt="Capa de ${esc(g.title)}" loading="lazy" referrerpolicy="no-referrer">`
    : `<span class="ph"><span class="ph-glyph">?</span><span class="ph-line">${esc(label)}</span><span class="ph-sub">${g.year} · sem capa</span></span>`;

  const trailer = g.youtube_id
    ? `<button class="play-poster" type="button" data-yt="${esc(g.youtube_id)}" aria-label="Tocar vídeo de ${esc(g.title)}" style="background-image:url('${ytPoster(g.youtube_id)}')"></button>`
    : `<div class="ph"><span class="ph-glyph">▶</span><span class="ph-line">sem trailer</span></div>`;

  const fallback = g.youtube_id
    ? `<div class="media-fallback"><a href="${ytWatch(g.youtube_id)}" target="_blank" rel="noopener">▶ abrir trailer no YouTube ↗</a></div>`
    : "";

  return `
    <div class="media">
      <div class="cover">${cover}</div>
      <div class="trailer" data-yt="${esc(g.youtube_id ?? "")}">${trailer}</div>
      ${fallback}
    </div>
    <div class="links">
      <a class="link-btn" href="${EMU[g.console].url}" target="_blank" rel="noopener">
        <span class="ico">🕹️</span><span>Baixar emulador<small>${esc(EMU[g.console].name)}</small></span>
      </a>
      <a class="link-btn" href="${romSearchUrl(g)}" target="_blank" rel="noopener">
        <span class="ico">💾</span><span>Baixar ROM<small>busca em PT-BR</small></span>
      </a>
    </div>`;
}

export function badgesHtml(g: Game): string {
  let b = `<span class="badge">${esc(EMU[g.console].label)}</span><span class="badge year">${g.year}</span>`;
  if (g.series && g.series_order && g.series_order > 1)
    b += `<span class="badge seq">SAGA · Nº ${g.series_order}</span>`;
  if (g.featured) b += `<span class="badge star">★ DESTAQUE</span>`;
  if (g.critic_score != null)
    b += `<span class="badge score">CRÍTICA ${g.critic_score}</span>`;
  return b;
}

/** Accordion do catálogo completo. `clubAvg` mapeia game_id → {avg,n}. */
export function catalogHtml(
  games: Game[],
  playedIds: Set<string>,
  archivedIds: Set<string>,
  clubAvg: Map<string, { avg: number; n: number }>,
): string {
  const rows = [...games].sort((a, b) => a.year - b.year || a.title.localeCompare(b.title));
  const done = playedIds.size;
  const items = rows
    .map((g) => {
      let cls = "avail";
      let mark = "";
      let note = "";
      if (playedIds.has(g.id)) {
        cls = "done";
        mark = "✓";
        const cav = clubAvg.get(g.id);
        if (cav) note = `<span class="cat-club">clube ${cav.avg.toFixed(1)}★</span> · `;
      } else {
        const blocker = blockingPredecessor(g, games, archivedIds);
        if (blocker) {
          cls = "locked";
          mark = "🔒";
          note = `depois de ${esc(blocker.title)} · `;
        }
      }
      const score =
        g.critic_score != null ? `<span class="cat-score">${g.critic_score}</span> · ` : "";
      const fav = g.featured ? ' <span class="fav" title="Destaque">★</span>' : "";
      return `<li class="cat-${cls}">
        <span class="cat-mark">${mark}</span>
        <span class="cat-name">${esc(g.title)}${fav}</span>
        <span class="cat-meta">${note}${score}${consoleShort(g.console)} · ${g.year}</span>
      </li>`;
    })
    .join("");
  return `<details class="catalog">
    <summary><span>LISTA COMPLETA — ${rows.length} JOGOS · ${done} JOGADOS</span></summary>
    <ul class="catalog-list">${items}</ul>
  </details>`;
}

export function monthGameHtml(g: Game, round: Round): string {
  const statusTxt =
    round.status === "jogando"
      ? "estamos jogando"
      : round.status === "avaliando"
        ? "mês encerrado — hora de avaliar"
        : "arquivado";
  return `
    <div class="month-status">JOGO DO MÊS · <b>${esc(statusTxt)}</b></div>
    <div class="badges">${badgesHtml(g)}</div>
    <div class="game-title">${esc(g.title)}</div>
    <p class="pitch">${esc(g.pitch ?? "")}</p>
    ${gameMediaHtml(g)}`;
}

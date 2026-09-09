import type { Game } from "../types";

export const FEATURED_WEIGHT = 3;

/**
 * Jogos que podem ser sorteados agora:
 *  - ativos
 *  - que nunca foram rodada (`playedIds` = game_id de qualquer rodada)
 *  - se são parte de saga (`series` + `series_order > 1`): todos os antecessores
 *    da mesma saga já precisam ter sido rodada arquivada (`archivedIds`)
 */
export function eligibleGames(
  games: Game[],
  playedIds: Set<string>,
  archivedIds: Set<string>,
): Game[] {
  return games.filter((g) => {
    if (!g.active) return false;
    if (playedIds.has(g.id)) return false;
    if (g.series && g.series_order && g.series_order > 1) {
      const predecessors = games.filter(
        (x) => x.series === g.series && (x.series_order ?? 0) < (g.series_order ?? 0),
      );
      return predecessors.every((p) => archivedIds.has(p.id));
    }
    return true;
  });
}

/** Peso de um jogo no sorteio. Destaque conta FEATURED_WEIGHT×. */
export function weightOf(g: Game): number {
  return g.featured ? FEATURED_WEIGHT : 1;
}

/**
 * Sorteia um jogo elegível, ponderado por Destaque.
 * `excludeId` tira o candidato atual ("sortear outro") — a menos que ele seja o único.
 * `rng` injetável pra teste. Retorna null se não há elegíveis.
 */
export function drawGame(
  eligible: Game[],
  opts: { excludeId?: string; rng?: () => number } = {},
): Game | null {
  const rng = opts.rng ?? Math.random;
  let pool = eligible;
  if (opts.excludeId && pool.length > 1) {
    pool = pool.filter((g) => g.id !== opts.excludeId);
  }
  if (pool.length === 0) return null;

  const total = pool.reduce((s, g) => s + weightOf(g), 0);
  let r = rng() * total;
  for (const g of pool) {
    r -= weightOf(g);
    if (r < 0) return g;
  }
  return pool[pool.length - 1]!; // fallback numérico
}

/** Para o catálogo: qual antecessor da saga ainda falta arquivar (ou null se liberado). */
export function blockingPredecessor(
  game: Game,
  games: Game[],
  archivedIds: Set<string>,
): Game | null {
  if (!game.series || !game.series_order || game.series_order <= 1) return null;
  const missing = games
    .filter(
      (x) =>
        x.series === game.series &&
        (x.series_order ?? 0) < (game.series_order ?? 0) &&
        !archivedIds.has(x.id),
    )
    .sort((a, b) => (a.series_order ?? 0) - (b.series_order ?? 0));
  return missing[0] ?? null;
}

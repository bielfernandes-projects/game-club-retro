import { describe, it, expect } from "vitest";
import { eligibleGames, drawGame, blockingPredecessor, weightOf } from "./draw";
import type { Game } from "../types";

const g = (over: Partial<Game>): Game => ({
  id: "x", title: "X", console: "PS1", year: 2000, youtube_id: null, pitch: null,
  series: null, series_order: null, wiki_title: null, cover_url: null,
  critic_score: null, critic_source: null, featured: false, active: true,
  ...over,
});

const suiko1 = g({ id: "s1", series: "s", series_order: 1 });
const suiko2 = g({ id: "s2", series: "s", series_order: 2 });
const suiko3 = g({ id: "s3", series: "s", series_order: 3 });
const solo = g({ id: "solo" });
const inactive = g({ id: "dead", active: false });

describe("eligibleGames", () => {
  const all = [suiko1, suiko2, suiko3, solo, inactive];

  it("exclui inativos e já jogados", () => {
    const e = eligibleGames(all, new Set(["solo"]), new Set());
    expect(e.map((x) => x.id).sort()).toEqual(["s1"]);
  });

  it("trava o nº 2 da saga até o nº 1 estar arquivado", () => {
    expect(eligibleGames(all, new Set(), new Set()).map((x) => x.id)).toContain("s1");
    expect(eligibleGames(all, new Set(), new Set()).map((x) => x.id)).not.toContain("s2");
    // s1 sorteado mas ainda não arquivado (rodada ativa) → s2 continua travado
    expect(eligibleGames(all, new Set(["s1"]), new Set()).map((x) => x.id)).not.toContain("s2");
    // s1 arquivado → s2 libera
    expect(eligibleGames(all, new Set(["s1"]), new Set(["s1"])).map((x) => x.id)).toContain("s2");
  });

  it("nº 3 exige nº 1 E nº 2 arquivados", () => {
    expect(eligibleGames(all, new Set(["s1"]), new Set(["s1"])).map((x) => x.id)).not.toContain("s3");
    expect(eligibleGames(all, new Set(["s1", "s2"]), new Set(["s1", "s2"])).map((x) => x.id)).toContain("s3");
  });
});

describe("drawGame", () => {
  it("retorna null com pool vazio", () => {
    expect(drawGame([])).toBeNull();
  });

  it("'sortear outro' não repete o candidato quando há alternativa", () => {
    const pool = [solo, suiko1];
    for (let i = 0; i < 20; i++) {
      expect(drawGame(pool, { excludeId: "solo", rng: () => i / 20 })?.id).toBe("s1");
    }
  });

  it("'sortear outro' devolve o mesmo se ele for o único elegível", () => {
    expect(drawGame([solo], { excludeId: "solo" })?.id).toBe("solo");
  });

  it("Destaque pesa FEATURED_WEIGHT× (distribuição)", () => {
    const featured = g({ id: "f", featured: true });
    const normal = g({ id: "n" });
    expect(weightOf(featured) / weightOf(normal)).toBe(3);
    let f = 0;
    const N = 12000;
    for (let i = 0; i < N; i++) {
      if (drawGame([featured, normal], { rng: Math.random })?.id === "f") f++;
    }
    // esperado ~0.75 ; folga generosa
    expect(f / N).toBeGreaterThan(0.68);
    expect(f / N).toBeLessThan(0.82);
  });
});

describe("blockingPredecessor", () => {
  const all = [suiko1, suiko2, suiko3];
  it("aponta o primeiro antecessor que falta arquivar", () => {
    expect(blockingPredecessor(suiko3, all, new Set())?.id).toBe("s1");
    expect(blockingPredecessor(suiko3, all, new Set(["s1"]))?.id).toBe("s2");
    expect(blockingPredecessor(suiko3, all, new Set(["s1", "s2"]))).toBeNull();
    expect(blockingPredecessor(suiko1, all, new Set())).toBeNull();
  });
});

import { supabase } from "../supabase";
import type { Game } from "../types";

export async function listGames(opts: { includeInactive?: boolean } = {}): Promise<Game[]> {
  let q = supabase.from("games").select("*").order("year").order("title");
  if (!opts.includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Game[];
}

export type GameInput = Omit<Game, "cover_url"> & { cover_url?: string | null };

export async function upsertGame(g: GameInput): Promise<void> {
  const { error } = await supabase.from("games").upsert(g, { onConflict: "id" });
  if (error) throw error;
}

export async function setGameActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("games").update({ active }).eq("id", id);
  if (error) throw error;
}

/** Exclui de vez. Falha com mensagem amigável se o jogo já foi rodada (FK). */
export async function deleteGame(id: string): Promise<void> {
  const { error } = await supabase.from("games").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      throw new Error("Esse jogo já foi jogo do mês em alguma rodada — não dá pra excluir (deixe inativo).");
    }
    throw error;
  }
}

export async function setGameFeatured(id: string, featured: boolean): Promise<void> {
  const { error } = await supabase.from("games").update({ featured }).eq("id", id);
  if (error) throw error;
}

/** Chama /api/enrich e grava capa + nota de crítica no jogo. */
export async function enrichGame(g: Game): Promise<{ cover_url: string | null; critic_score: number | null }> {
  const params = new URLSearchParams();
  if (g.wiki_title) params.set("title", g.wiki_title);
  params.set("name", g.title);
  const res = await fetch(`/api/enrich?${params}`);
  if (!res.ok) throw new Error("enrich falhou");
  const data = (await res.json()) as {
    cover_url: string | null;
    critic_score: number | null;
    critic_source: "rawg" | null;
  };
  const patch: Partial<Game> = {};
  if (data.cover_url) patch.cover_url = data.cover_url;
  if (data.critic_score != null && g.critic_source !== "manual") {
    patch.critic_score = data.critic_score;
    patch.critic_source = "rawg";
  }
  if (Object.keys(patch).length) {
    const { error } = await supabase.from("games").update(patch).eq("id", g.id);
    if (error) throw error;
  }
  return { cover_url: data.cover_url, critic_score: data.critic_score };
}

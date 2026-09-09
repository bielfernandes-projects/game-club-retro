import { supabase } from "../supabase";
import type { Round } from "../types";

export async function listRounds(): Promise<Round[]> {
  const { data, error } = await supabase.from("rounds").select("*").order("drawn_at");
  if (error) throw error;
  return (data ?? []) as Round[];
}

/** A rodada não-arquivada (jogando ou avaliando), ou null. */
export async function activeRound(): Promise<Round | null> {
  const { data, error } = await supabase
    .from("rounds")
    .select("*")
    .neq("status", "arquivada")
    .maybeSingle();
  if (error) throw error;
  return (data as Round) ?? null;
}

export async function createRound(gameId: string, drawnBy: string): Promise<Round> {
  const { data, error } = await supabase
    .from("rounds")
    .insert({ game_id: gameId, drawn_by: drawnBy })
    .select()
    .single();
  if (error) throw error;
  return data as Round;
}

export async function closeRound(id: string): Promise<void> {
  const { error } = await supabase
    .from("rounds")
    .update({ status: "avaliando", closed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function archiveRound(id: string): Promise<void> {
  const { error } = await supabase
    .from("rounds")
    .update({ status: "arquivada", archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

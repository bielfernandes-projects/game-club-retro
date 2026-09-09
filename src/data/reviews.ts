import { supabase } from "../supabase";
import type { Review } from "../types";

export interface ReviewWithAuthor extends Review {
  author: string;
}

export async function listReviews(roundId: string): Promise<ReviewWithAuthor[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*, profiles(display_name)")
    .eq("round_id", roundId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((r) => {
    const { profiles, ...rest } = r as Review & { profiles: { display_name: string | null } | null };
    return { ...rest, author: profiles?.display_name || "membro" };
  });
}

/** Média das notas do clube por **game_id** (via join com rounds), pro catálogo. */
export async function reviewAverages(): Promise<Map<string, { avg: number; n: number }>> {
  const { data, error } = await supabase.from("reviews").select("rating, rounds(game_id)");
  if (error) throw error;
  const acc = new Map<string, { sum: number; n: number }>();
  type Row = { rating: number; rounds: { game_id: string } | { game_id: string }[] | null };
  for (const r of (data ?? []) as unknown as Row[]) {
    const gid = Array.isArray(r.rounds) ? r.rounds[0]?.game_id : r.rounds?.game_id;
    if (!gid) continue;
    const cur = acc.get(gid) ?? { sum: 0, n: 0 };
    cur.sum += r.rating;
    cur.n += 1;
    acc.set(gid, cur);
  }
  return new Map([...acc].map(([k, v]) => [k, { avg: v.sum / v.n, n: v.n }]));
}

export async function upsertReview(
  roundId: string,
  memberId: string,
  rating: number,
  body: string,
): Promise<void> {
  const { error } = await supabase.from("reviews").upsert(
    { round_id: roundId, member_id: memberId, rating, body: body.trim() || null },
    { onConflict: "round_id,member_id" },
  );
  if (error) throw error;
}

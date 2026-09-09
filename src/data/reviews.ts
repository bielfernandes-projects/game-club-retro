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

/** Média das notas por round_id, para o catálogo. */
export async function reviewAverages(): Promise<Map<string, { avg: number; n: number }>> {
  const { data, error } = await supabase.from("reviews").select("round_id, rating");
  if (error) throw error;
  const acc = new Map<string, { sum: number; n: number }>();
  for (const r of (data ?? []) as { round_id: string; rating: number }[]) {
    const cur = acc.get(r.round_id) ?? { sum: 0, n: 0 };
    cur.sum += r.rating;
    cur.n += 1;
    acc.set(r.round_id, cur);
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

import { supabase } from "../supabase";
import type { StoreItem } from "../types";

export async function listStoreItems(
  opts: { includeInactive?: boolean } = {},
): Promise<StoreItem[]> {
  let q = supabase.from("store_items").select("*").order("sort_order").order("created_at");
  if (!opts.includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as StoreItem[];
}

export type StoreItemInput = Partial<StoreItem> & { label: string };

export async function upsertStoreItem(item: StoreItemInput): Promise<void> {
  const { error } = await supabase.from("store_items").upsert(item, { onConflict: "id" });
  if (error) throw error;
}

export async function setStoreItemActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from("store_items").update({ active }).eq("id", id);
  if (error) throw error;
}

export async function deleteStoreItem(id: string): Promise<void> {
  const { error } = await supabase.from("store_items").delete().eq("id", id);
  if (error) throw error;
}

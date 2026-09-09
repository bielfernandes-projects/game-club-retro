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

export interface ShopeeProduct {
  image: string | null;
  title: string | null;
  price: string | null;
  link: string | null;
  rating: number | null;
  sales: number | null;
  commission: number | null;
  item_id: number | null;
  shop_id: number | null;
}

/** Chama /api/shopee. Passe `keyword`, `url` (link colado) OU `itemId`+`shopId`. */
export async function fetchShopeeProduct(
  ref: { keyword: string } | { url: string } | { itemId: number; shopId: number },
): Promise<ShopeeProduct> {
  let qs: string;
  if ("keyword" in ref) qs = `keyword=${encodeURIComponent(ref.keyword)}`;
  else if ("url" in ref) qs = `url=${encodeURIComponent(ref.url)}`;
  else qs = `itemId=${ref.itemId}&shopId=${ref.shopId}`;
  const res = await fetch(`/api/shopee?${qs}`);
  if (!res.ok) throw new Error("Não consegui buscar na Shopee");
  return (await res.json()) as ShopeeProduct;
}

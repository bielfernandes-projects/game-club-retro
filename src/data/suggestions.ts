import { supabase } from "../supabase";
import type { Suggestion, SuggestionStatus } from "../types";

export interface SuggestionWithAuthor extends Suggestion {
  author: string;
}

export async function listSuggestions(): Promise<SuggestionWithAuthor[]> {
  const { data, error } = await supabase
    .from("suggestions")
    .select("*, profiles(display_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((s) => {
    const { profiles, ...rest } = s as Suggestion & {
      profiles: { display_name: string | null } | null;
    };
    return { ...rest, author: profiles?.display_name || "membro" };
  });
}

export async function createSuggestion(
  title: string,
  note: string,
  memberId: string,
): Promise<void> {
  const { error } = await supabase.from("suggestions").insert({
    title: title.trim(),
    note: note.trim() || null,
    suggested_by: memberId,
  });
  if (error) throw error;
}

export async function setSuggestionStatus(
  id: string,
  status: SuggestionStatus,
  adminNote?: string,
): Promise<void> {
  const { error } = await supabase
    .from("suggestions")
    .update({
      status,
      decided_at: status === "pendente" ? null : new Date().toISOString(),
      admin_note: adminNote?.trim() || null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteSuggestion(id: string): Promise<void> {
  const { error } = await supabase.from("suggestions").delete().eq("id", id);
  if (error) throw error;
}

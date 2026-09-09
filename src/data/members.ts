import { supabase } from "../supabase";
import type { Role } from "../types";

export interface AllowlistEntry {
  email: string;
  role: Role;
  created_at: string;
  joined: boolean; // já logou ao menos uma vez?
}

export async function listAllowlist(): Promise<AllowlistEntry[]> {
  const [{ data: allow, error }, { data: profiles }] = await Promise.all([
    supabase.from("allowlist").select("*").order("created_at"),
    supabase.from("profiles").select("email"),
  ]);
  if (error) throw error;
  const seen = new Set((profiles ?? []).map((p) => (p.email ?? "").toLowerCase()));
  return (allow ?? []).map((a) => ({
    email: a.email,
    role: a.role as Role,
    created_at: a.created_at,
    joined: seen.has(a.email.toLowerCase()),
  }));
}

export async function addMember(email: string, role: Role = "membro"): Promise<void> {
  const { error } = await supabase
    .from("allowlist")
    .upsert({ email: email.trim().toLowerCase(), role }, { onConflict: "email" });
  if (error) throw error;
}

export async function removeMember(email: string): Promise<void> {
  const { error } = await supabase.from("allowlist").delete().eq("email", email);
  if (error) throw error;
}

export async function setMemberRole(email: string, role: Role): Promise<void> {
  const { error } = await supabase.from("allowlist").update({ role }).eq("email", email);
  if (error) throw error;
}

// ---------------------------------------------------------------- convite

/** Cliente (anon): troca o código de convite por entrada na allowlist. */
export async function redeemInvite(email: string, code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("redeem_invite", {
    p_email: email.trim().toLowerCase(),
    p_code: code.trim(),
  });
  if (error) throw error;
  return data === true;
}

/** Admin: lê/gera o código de convite atual. */
export async function getInviteCode(): Promise<string | null> {
  const { data, error } = await supabase
    .from("club_config")
    .select("value")
    .eq("key", "invite_code")
    .maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

export async function setInviteCode(code: string): Promise<void> {
  const { error } = await supabase
    .from("club_config")
    .upsert({ key: "invite_code", value: code.trim() }, { onConflict: "key" });
  if (error) throw error;
}

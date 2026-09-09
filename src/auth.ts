import { supabase } from "./supabase";
import type { Session } from "./types";

/** Resolve a sessão atual: auth + papel (via RPCs is_admin / is_member). */
export async function currentSession(): Promise<Session | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: isAdmin }, { data: isMember }] = await Promise.all([
    supabase.from("profiles").select("display_name,email").eq("id", user.id).maybeSingle(),
    supabase.rpc("is_admin"),
    supabase.rpc("is_member"),
  ]);

  const email = user.email ?? profile?.email ?? "";
  return {
    userId: user.id,
    email,
    displayName: profile?.display_name || email.split("@")[0] || "membro",
    role: isAdmin ? "admin" : isMember ? "membro" : null,
  };
}

export async function sendMagicLink(email: string) {
  return supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: window.location.origin + window.location.pathname,
    },
  });
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function updateDisplayName(userId: string, name: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: name.trim() || null })
    .eq("id", userId);
  if (error) throw error;
}

/** Chama `cb` sempre que o estado de auth muda (login/logout/refresh). */
export function onAuthChange(cb: () => void) {
  supabase.auth.onAuthStateChange(() => cb());
}

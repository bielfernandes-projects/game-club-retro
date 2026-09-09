export type ConsoleCode = "SNES" | "MD" | "N64" | "PS1" | "GBA" | "GBC";
export type RoundStatus = "jogando" | "avaliando" | "arquivada";
export type Role = "admin" | "membro";

export interface Game {
  id: string;
  title: string;
  console: ConsoleCode;
  year: number;
  youtube_id: string | null;
  pitch: string | null;
  series: string | null;
  series_order: number | null;
  wiki_title: string | null;
  cover_url: string | null;
  critic_score: number | null;
  critic_source: "rawg" | "manual" | null;
  featured: boolean;
  active: boolean;
}

export interface Round {
  id: string;
  game_id: string;
  status: RoundStatus;
  drawn_at: string;
  closed_at: string | null;
  archived_at: string | null;
  drawn_by: string | null;
}

export interface Review {
  id: string;
  round_id: string;
  member_id: string;
  rating: number;
  body: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
}

export type SuggestionStatus = "pendente" | "aceita" | "recusada";

export interface Suggestion {
  id: string;
  title: string;
  note: string | null;
  suggested_by: string;
  status: SuggestionStatus;
  admin_note: string | null;
  created_at: string;
  decided_at: string | null;
}

/** Sessão do usuário resolvida (auth + papel). */
export interface Session {
  userId: string;
  email: string;
  displayName: string;
  role: Role | null; // null = logado mas fora da allowlist
}

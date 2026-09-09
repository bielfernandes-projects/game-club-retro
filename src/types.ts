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

/** Um item da seção "Loja" — o cron diário busca a oferta de maior comissão pra cada `keyword`. */
export interface StoreItem {
  id: string;
  label: string; // nome que aparece no card
  keyword: string | null; // termo de busca do cron; null = item avulso
  url: string | null; // link curto de afiliado (rastreável); null = ainda não preenchido
  title: string | null; // nome cru do produto na Shopee
  image_url: string | null;
  price: string | null; // texto livre: "R$ 349,90"
  rating: number | null; // 0–5
  sales: number | null;
  commission: number | null; // % de comissão da oferta escolhida
  item_id: number | null; // ref do produto Shopee (p/ re-buscar)
  shop_id: number | null;
  sort_order: number;
  active: boolean;
  refreshed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Sessão do usuário resolvida (auth + papel). */
export interface Session {
  userId: string;
  email: string;
  displayName: string;
  role: Role | null; // null = logado mas fora da allowlist
}

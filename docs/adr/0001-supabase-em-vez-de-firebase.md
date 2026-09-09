# 0001 — Supabase em vez de Firebase

**Status:** aceito · 2025

## Contexto

O site (estático, no Vercel) precisou de contas: auth por magic link, papéis (admin × membro),
e dados relacionais — Rodada → Avaliações, allowlist, catálogo com CRUD. O dono sugeriu
Firebase.

## Decisão

Usar **Supabase** (Postgres + Auth + RLS + Realtime), provisionado pelo **Marketplace do
Vercel**.

## Alternativas

- **Firebase (Auth + Firestore).** Funciona client-side, free tier generoso. Mas as regras de
  segurança do Firestore pra "só admin escreve `games`/`rounds`, só o autor edita a própria
  review, e só quando a Rodada está `avaliando`" ficam verbosas e frágeis; e Firestore é
  documento, enquanto Rodada→Review→Membro é relacional.
- **Clerk (auth) + Neon (Postgres).** Mais no espírito Vercel, mas são duas peças + duas
  contas pra um app de ~10 pessoas.

## Consequências

- RLS declarativa no Postgres resolve o controle de acesso com policies pequenas e testáveis
  (`scripts/rls-check.mjs`).
- Um vendor só, billing unificado no Vercel, env vars sincronizadas automaticamente.
- Some um segundo provedor (Google) do stack.
- **Difícil de reverter:** schema + auth + sessões já em produção. Trocar de backend depois é
  reescrever a camada de dados e migrar usuários.

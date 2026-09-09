# Setup

## Estado atual

O backend está num **projeto Supabase standalone** na org `castordosgames@gmail.com`
(`wikbubnxkxazzsikhelo`, região São Paulo) — **não** é mais o do Marketplace do Vercel
(esse foi removido).

Já configurado por API:

- ✅ Schema + RLS + hooks + realtime + seed (49 jogos + admin `gabriel.fernandeshw@gmail.com`).
- ✅ Auth: Site URL + redirect URLs (`gameclub.bf.dev.br`, localhost, previews).
- ✅ SMTP via **Resend** (remetente `Game Club Retrô <clube@bf.dev.br>`, domínio verificado).
  Rate limit de e-mail: **100/h**. Template do magic link aplicado pelo painel a partir de
  [`supabase/email-magiclink.html`](supabase/email-magiclink.html) — editar lá e recolar em
  **Authentication → Emails → Templates → Magic Link** (a Management API recusa o token
  atual com 403, então é sempre pelo painel).
- ✅ Hook **before-user-created** ligado → e-mail fora da allowlist não cria conta.
- ✅ `RAWG_API_KEY` no Vercel (production + preview + development).
- ✅ Env vars `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` no Vercel.

### Loja

- Migrations `supabase/migrations/0004_store.sql` (tabela `store_items` + 7 rótulos de
  exemplo) e `0005_store_manual.sql` (tira as colunas da antiga integração Shopee).
  Aplicar: `node --env-file=.env.local scripts/sql.mjs supabase/migrations/000X_*.sql`.
- CRUD 100% manual no `#/admin` → Loja. Sem API externa, sem chave, sem cron.

## Falta

1. **Você:** deletar os projetos Supabase que não são o `wikbubnxkxazzsikhelo`
   (`hkpqfpzuravrxhoyovzq`, e o do Marketplace `zplbyolguhodemmpzgvl` se ainda aparecer).
2. **Você (quando puder):** trocar o `SUPABASE_ACCESS_TOKEN` por um com acesso de owner à org
   `castordosgames` — o atual dá 403 na Management API, então mudança de config de Auth
   (templates, rate limits, SMTP) só dá pra fazer pelo painel.

O app já está no ar e em uso: login por magic link, sorteio, avaliações e indicações
testados ponta a ponta.

## Segredos (guardados fora do git)

Tudo em `.env.local` (git-ignored) e nas env vars do Vercel/Supabase. As chaves que você colou
no chat (access token Supabase, Resend, RAWG) já estão nos lugares certos — pode
**rotacionar** depois se quiser (gere novas e me avisa, ou troca você mesmo no Vercel/Supabase).

## Rodar local

```bash
npm install
npm run dev          # usa .env.local
npm test
node --env-file=.env.local scripts/rls-check.mjs
```

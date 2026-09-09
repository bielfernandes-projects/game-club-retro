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

### Loja (Shopee Affiliate)

- Migration `supabase/migrations/0004_store.sql` (tabela `store_items` + os 7 itens fixos).
  Aplicar: `node --env-file=.env.local scripts/sql.mjs supabase/migrations/0004_store.sql`.
- **Falta você:** adicionar no Vercel (todos os ambientes) as env vars **server-only**:
  - `SHOPEE_APP_ID` e `SHOPEE_APP_SECRET` (painel de Afiliados da Shopee) — já estão no
    `.env.local`. **Foram coladas no chat — dá pra rotacionar depois.**
  - `CRON_SECRET` (qualquer string aleatória) — o Vercel manda no header do cron; `api/store-refresh`
    recusa quem não tiver. Sem ela o endpoint fica aberto (baixo risco, mas melhor pôr).
  - `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_URL` (o cron escreve no banco fora do RLS) — conferir
    que existem no Vercel.
- O cron roda **09:00 UTC** (06:00 BRT) todo dia — ver `vercel.json`. Pra forçar: o botão
  **"buscar todos agora"** no `#/admin` → Loja, ou
  `curl -H "authorization: Bearer $CRON_SECRET" https://gameclub.bf.dev.br/api/store-refresh`.

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

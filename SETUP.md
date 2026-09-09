# Setup

## Estado atual

O backend está num **projeto Supabase standalone** na org `castordosgames@gmail.com`
(`wikbubnxkxazzsikhelo`, região São Paulo) — **não** é mais o do Marketplace do Vercel
(esse foi removido).

Já configurado por API:

- ✅ Schema + RLS + hooks + realtime + seed (49 jogos + admin `gabriel.fernandeshw@gmail.com`).
- ✅ Auth: Site URL + redirect URLs (`gameclub.bf.dev.br`, localhost, previews).
- ✅ SMTP via **Resend** (remetente `Game Club Retrô <clube@bf.dev.br>`, domínio verificado).
  Rate limit de e-mail: 100/h. Template do magic link em
  [`supabase/email-magiclink.html`](supabase/email-magiclink.html) — colar em
  **Authentication → Email Templates → Magic Link** (o painel é a única via: a
  Management API recusa o token atual com 403).
- ✅ Hook **before-user-created** ligado → e-mail fora da allowlist não cria conta.
- ✅ `RAWG_API_KEY` no Vercel (production + preview + development).
- ✅ Env vars `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` no Vercel.

## Falta

1. **Você:** deletar os projetos Supabase que não são o `wikbubnxkxazzsikhelo`:
   - `hkpqfpzuravrxhoyovzq` (o que você criou à mão).
   - Se o do Marketplace (`zplbyolguhodemmpzgvl`) ainda aparecer no dashboard, some sozinho —
     a resource foi removida do Vercel.
2. **Claude:** testar a preview (login como admin, sorteio, avaliação) → merge pra `main`.

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

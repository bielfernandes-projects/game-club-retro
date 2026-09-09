# Setup — o que falta pra `feat/club-app` ir pro ar

O código, o schema e o seed já estão prontos e testados. Falta configurar 3 serviços
externos. Passos marcados **[você]** precisam da sua conta; **[claude]** eu faço quando
você me passar o que pedir.

---

## 1. Deletar o projeto Supabase duplicado  **[você]**

Você criou o `hkpqfpzuravrxhoyovzq` à mão enquanto eu criava o `zplbyolguhodemmpzgvl`
(o do Marketplace do Vercel, que é o que estamos usando).

→ Dashboard do Supabase → projeto `hkpqfpzuravrxhoyovzq` → Settings → General → **Delete project**.
Isso também invalida a service role key que você colou no chat.

---

## 2. Supabase Auth  **[você OU claude]**

**Opção A (rápida, eu faço):** gere um _personal access token_ em
`https://supabase.com/dashboard/account/tokens` e me mande. Eu rodo
`node --env-file=.env.local scripts/setup-auth.mjs` e configuro tudo.

**Opção B (dashboard, você faz):** projeto `zplbyolguhodemmpzgvl` →

- **Authentication → URL Configuration**
  - Site URL: `https://gameclub.bf.dev.br`
  - Redirect URLs (Additional): `https://gameclub.bf.dev.br/**`, `http://localhost:5173/**`,
    `https://game-club-retro-*-bielfernandes-projects-projects.vercel.app/**`
- **Authentication → Hooks → Before User Created**
  - Enable → tipo **Postgres** → schema `public` → função `hook_before_user_created`
  - (Isso barra signup de e-mail que não está na allowlist. Sem isso, um estranho consegue
    criar conta — mas fica sem acesso a nada pelas RLS.)

---

## 3. Resend (e-mail do magic link)  **[você]** — obrigatório

O SMTP nativo do Supabase só manda **2 e-mails/hora** e **recusa endereço fora do time**.
Sem Resend, ninguém do clube consegue logar.

1. `resend.com` → criar conta.
2. **Domains → Add Domain** → `bf.dev.br` (ou `mail.bf.dev.br`). Ele te dá 3 registros DNS
   (SPF/DKIM). Como o `bf.dev.br` usa nameserver da Vercel, adicione em
   `vercel.com → bf.dev.br → DNS`. Espere verificar (~minutos).
3. **API Keys → Create** (permissão "Sending access").
4. Me mande: a API key **ou** os 4 valores de SMTP (host `smtp.resend.com`, port `465`,
   user `resend`, pass = a API key). Eu configuro no Supabase via `setup-auth.mjs`.
   Sender: `Game Club Retrô <clube@bf.dev.br>` (ajuste o local part se quiser).

---

## 4. RAWG (nota de crítica / "Metacritic")  **[você]** — opcional (Fase 2)

1. `rawg.io/apidocs` → "Get API Key" (60 segundos, grátis, 20k req/mês).
2. Me mande a key. Eu rodo `vercel env add RAWG_API_KEY` (production + preview).

Sem isso: o catálogo funciona, só não mostra a nota externa até você preencher à mão no
CRUD do admin.

---

## 5. Ir pro ar  **[claude]**

Depois de 2 e 3: eu testo a preview (`feat/club-app`), você confirma o login, e aí eu faço
o merge pra `main` → sobe em `https://gameclub.bf.dev.br` (o site estático atual sai do ar
nesse momento).

> A preview (`game-club-retro-git-feat-…vercel.app`) hoje pede login no Vercel — abra
> logado na sua conta Vercel. Se quiser liberar pro pessoal testar antes do merge, dá pra
> desligar a "Deployment Protection" de preview no projeto.

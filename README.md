# Game Club Retrô

App do clube: sorteia **um clássico incontestável (modo história) por mês**, com capa,
trailer e links de emulador/ROM; e depois cada membro **avalia** o jogo.

**No ar:** https://gameclub.bf.dev.br

## Papéis

| Quem | Pode |
|---|---|
| visitante (deslogado) | ver o catálogo, o jogo do mês e as avaliações |
| **membro** (na allowlist) | tudo acima + **avaliar** (nota 1–5 + crítica) quando o mês fecha |
| **admin** | sortear, controlar as rodadas, CRUD dos jogos, gerenciar a allowlist |

Login é por **magic link**. Membro novo entra sozinho com o **link de convite** que o admin
compartilha no grupo (`#/admin` → Membros → Link de convite); o admin também pode adicionar
e-mails na mão.

## Ciclo mensal

```
admin sorteia → confirma → Rodada "jogando"  (todo mundo joga)
  → admin "encerra o mês" → "avaliando"       (membros dão nota + crítica)
  → admin "arquiva"        → "arquivada"       (libera o próximo sorteio)
```

Sagas jogam na ordem: *Suikoden II* só entra no sorteio depois que *Suikoden I* for arquivado.
Jogos em **Destaque** (★, definido pelo admin) contam **3×** no sorteio.

A lista completa é ordenada A→Z e tem busca por nome. Clicar em qualquer jogo abre a **ficha**
dele (capa, trailer, links de emulador/ROM e a média do clube, se já foi jogado) — o mesmo
pop-up do sorteio. No `#/admin` → Jogos a tabela também tem busca e ordenação por coluna.

## Loja

Botão piscante no rodapé da home → página `#/loja` com consoles/acessórios retrô à venda.
O admin (`#/admin` → Loja) cadastra tudo na mão: nome, link de afiliado, foto, preço, nota e
vendidos. O card só aparece na home quando tem link de afiliado.

## Rodar local

```bash
npm install
vercel env pull            # traz VITE_SUPABASE_* pra .env.local
npm run dev                # http://localhost:5173
npm test                   # testes de draw.ts
```

## Deploy

Push na `main` → Vercel publica em `gameclub.bf.dev.br`. Push em qualquer branch → preview.
O schema/seed do Supabase vive em `supabase/` (aplicado com `scripts/sql.mjs`).

Config inicial dos serviços externos (Supabase Auth, Resend, RAWG): ver **[SETUP.md](SETUP.md)**.

## Estrutura

```
src/
  main.ts        bootstrap + router + view "home" (sorteador / jogo do mês / avaliações)
  admin.ts       painel admin (CRUD de jogos + allowlist)
  components.ts  builders de HTML puros (catálogo, mídia, badges, estrelas)
  data/          games · rounds · reviews · members · draw (lógica pura + testes)
  auth.ts        magic link, sessão, papel
  supabase.ts    cliente
api/enrich.ts    função serverless: capa (Wikipédia) + nota Metacritic (RAWG)
supabase/
  migrations/    schema + RLS + hooks + realtime
  seed.sql       49 jogos + admin  (gerado por scripts/gen-seed.mjs)
```

Detalhes técnicos: **[ARCHITECTURE.md](ARCHITECTURE.md)** · Vocabulário: **[CONTEXT.md](CONTEXT.md)**

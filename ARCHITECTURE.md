# Arquitetura

Vite + TypeScript (vanilla, sem framework). Deploy estático no Vercel + **uma** função
serverless (`api/enrich.ts`). Backend: **Supabase** (Postgres + Auth + RLS + Realtime).

Recursos externos: fontes do Google Fonts; capas da Wikipédia (via `api/enrich`); pôster e
player de vídeo do YouTube; nota de crítica da RAWG (via `api/enrich`, chave no servidor).

## Banco (Supabase / Postgres)

`supabase/migrations/0001_init.sql`. Cinco tabelas, todas com RLS.

| Tabela | O quê | Escrita liberada pra |
|---|---|---|
| `allowlist` | `email` → `role` (`admin`\|`membro`) | só `is_admin()` |
| `profiles` | perfil (id = `auth.users.id`), criado no 1º login por trigger | o próprio (só `display_name`) |
| `games` | catálogo (49 no seed) + `featured`, `active`, `cover_url`, `critic_score` | só `is_admin()` |
| `rounds` | `game_id` + `status` (`jogando`→`avaliando`→`arquivada`) | só `is_admin()` |
| `reviews` | `round_id` + `member_id` + `rating` (1–5) + `body` (≤280) | o próprio autor, **e** só se a rodada está `avaliando` |

Leitura de `games`/`rounds`/`reviews`/`profiles` é **pública** (`anon` + `authenticated`).

### Funções / triggers

- `is_admin()`, `is_member()` — `security definer`, `search_path` travado; só revelam um
  booleano sobre o chamador (juntam `profiles` × `allowlist`). Expostas como RPC.
- `handle_new_user()` — trigger em `auth.users`: cria o `profiles` (nome = parte antes do `@`).
- `hook_before_user_created(event jsonb)` — **auth hook**: rejeita signup de e-mail fora da
  allowlist. Criado na migration; **registrar** é passo de dashboard/Management API (SETUP.md).
- `enforce_single_active_round()` — trigger: no máx. uma Rodada não-arquivada.
- Realtime: `rounds`, `reviews`, `games` na publication `supabase_realtime`.

RLS verificada por `scripts/rls-check.mjs` (11 checagens, roles simuladas).

## Elegibilidade e sorteio — `src/data/draw.ts` (puro, testado)

```
elegível(g) = g.active
           && g.id ∉ { rounds.game_id }
           && (sem saga  ||  todo antecessor da saga ∈ rounds arquivadas)
peso(g)     = g.featured ? 3 : 1
drawGame(elegíveis, {excludeId}) = escolha aleatória ponderada; excludeId = "sortear outro"
```

Roda no navegador do admin (ver ADR 0002). A RLS garante só *quem* cria Rodada.

## Fluxo da interface (`src/main.ts`)

Router por hash: `#/` (home), `#/admin`, `#/entrar`, `#/perfil`. Um `refresh()` recarrega
`session + games + rounds + médias` e re-renderiza; disparado por `hashchange`, mudança de
auth, e **Realtime** (qualquer INSERT/UPDATE em `rounds`/`reviews`/`games`).

Home:
- **admin, sem rodada ativa:** área de sorteio (animação slot → candidato → "confirmar como
  jogo do mês" cria a Rodada → modal + confete).
- **admin, com rodada:** card do jogo do mês + botões `encerrar o mês` / `arquivar`.
- **membro / deslogado:** card do jogo do mês (só leitura) ou "ainda não tem jogo do mês".
- **rodada `avaliando`:** formulário de avaliação (se membro) + lista de reviews + média.
- **catálogo** (accordion) sempre, com ✓ jogado / 🔒 travado / ★ destaque / nota de crítica /
  média do clube.

## `api/enrich.ts`

`GET /api/enrich?title=<wiki>&name=<jogo>` → `{ cover_url, critic_score, critic_source }`.
Capa: `en.wikipedia.org/api/rest_v1/page/summary`. Crítica: `api.rawg.io/api/games?search=`
(campo `metacritic`). `RAWG_API_KEY` fica só no servidor. Chamado só em ação do admin
(criar/editar jogo, botão "re-buscar"). CRUD permite override manual da nota.

## Limitações conhecidas

- **RAWG e retrô:** alguns títulos JP-only não têm `metacritic` → override manual no CRUD.
- **`api/enrich` é aberta** (proxy de dados públicos). Baixo risco; cacheada 24h.
- **Sorteio no cliente** — ver ADR 0002.
- **Animação de slot** parece lenta se a aba do Chrome está em segundo plano (o navegador
  estrangula `setTimeout`). Com a aba na frente são ~2s.

## Como adicionar um jogo

Pelo **painel admin** (`#/admin` → Jogos → Novo jogo). Ou, em massa, editar
`scripts/gen-seed.mjs` e rodar `node scripts/gen-seed.mjs && node --env-file=.env.local
scripts/sql.mjs supabase/seed.sql` (upsert idempotente).

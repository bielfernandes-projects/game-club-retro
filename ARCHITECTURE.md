# Arquitetura

Vite + TypeScript (vanilla, sem framework). Deploy estático no Vercel + **uma** função
serverless (`api/enrich.ts`). Backend: **Supabase** (Postgres + Auth + RLS + Realtime).

Recursos externos: fontes do Google Fonts; capas da Wikipédia (via `api/enrich`); pôster e
player de vídeo do YouTube; nota de crítica da RAWG (via `api/enrich`, chave no servidor).

## Banco (Supabase / Postgres)

`supabase/migrations/`. Oito tabelas, todas com RLS.

| Tabela | O quê | Escrita liberada pra |
|---|---|---|
| `allowlist` | `email` → `role` (`admin`\|`membro`) | só `is_admin()` |
| `club_config` | config chave→valor (hoje só `invite_code`) | só `is_admin()` (o RPC lê via definer) |
| `profiles` | perfil (id = `auth.users.id`), criado no 1º login por trigger | o próprio (só `display_name`) |
| `games` | catálogo (49 no seed) + `featured`, `active`, `cover_url`, `critic_score` | só `is_admin()` |
| `rounds` | `game_id` + `status` (`jogando`→`avaliando`→`arquivada`) | só `is_admin()` |
| `reviews` | `round_id` + `member_id` + `rating` (1–5) + `body` (≤280) | o próprio autor, **e** só se a rodada está `avaliando` |
| `suggestions` | jogo que um membro quer (`title` + `note` + `status` pendente/aceita/recusada) | membro cria a própria; admin muda `status`; autor ou admin apaga |
| `store_items` | item da Loja (`label`, `url` de afiliado, `image_url`, `price`, `rating`, `sales`, `sort_order`, `active`) — CRUD manual | só `is_admin()` |

Leitura de `games`/`rounds`/`reviews`/`profiles`/`suggestions`/`store_items` é **pública**
(`anon` + `authenticated`).

### Funções / triggers

- `is_admin()`, `is_member()` — `security definer`, `search_path` travado; só revelam um
  booleano sobre o chamador (juntam `profiles` × `allowlist`). Expostas como RPC.
- `handle_new_user()` — trigger em `auth.users`: cria o `profiles` (nome = parte antes do `@`).
- `hook_before_user_created(event jsonb)` — **auth hook**: rejeita signup de e-mail fora da
  allowlist. Registrado via Management API (`scripts/setup-auth.mjs`).
- `redeem_invite(email, code)` — `security definer`, chamável por `anon`: se o código bate o
  `club_config.invite_code`, insere o e-mail na allowlist como `membro`. O cliente chama isso
  antes do `signInWithOtp` no fluxo de convite.
- `enforce_single_active_round()` — trigger: no máx. uma Rodada não-arquivada.
- `touch_updated_at()` — trigger `before update` em `games`, `reviews`, `store_items`.
- Realtime: `rounds`, `reviews`, `games`, `suggestions`, `store_items` na publication `supabase_realtime`.

RLS verificada por `scripts/rls-check.mjs` (roles simuladas). As checagens de `store_items`
passam; duas checagens antigas (`trigger cria profile`, `admin: is_admin()`) falham desde que
o banco ganhou usuários reais, porque as fixtures colidem por e-mail com o admin real.

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

Router por hash: `#/` (home), `#/loja`, `#/admin`, `#/entrar`, `#/perfil`. Um `refresh()` recarrega
`session + games + rounds + médias + loja` e re-renderiza; disparado por `hashchange`, mudança
de auth (só quando o usuário **muda** — não a cada foco de aba) e **Realtime** (INSERT/UPDATE
em `rounds`/`reviews`/`games`/`suggestions`/`store_items`). No `#/admin` o Realtime só
recarrega os dados em silêncio, sem redesenhar (o admin está editando).

Home:
- **admin, sem rodada ativa:** área de sorteio (animação slot → candidato → "confirmar como
  jogo do mês" cria a Rodada → modal + confete).
- **admin, com rodada:** card do jogo do mês + botões `encerrar o mês` / `arquivar`.
- **membro / deslogado:** card do jogo do mês (só leitura) ou "ainda não tem jogo do mês".
- **rodada `avaliando`:** formulário de avaliação (se membro) + lista de reviews + média.
- **catálogo** (accordion) sempre, ordenado A→Z, com **busca por nome** (`.cat-search`,
  `searchNorm` = minúsculo + sem acento) e marcas ✓ jogado / 🔒 travado / ★ destaque / nota de
  crítica / média do clube. Clicar (ou Enter) numa linha abre o **pop-up de ficha** do jogo —
  `openModal(g, { hideCover, body, cta })`, o mesmo componente do modal de sorteio, com a
  mídia completa (`gameMediaHtml`) no corpo. Com o modal aberto, `html`/`body` ganham
  `.modal-open` (`overflow: hidden`) e o fundo não rola.

## Painel admin (`src/admin.ts`)

Quatro abas (`Jogos`, `Sugestões`, `Loja`, `Membros`). O `onChange` do admin redesenha **só o
painel** (não o `#app`) e restaura a rolagem; edição inline de campo/checkbox grava no banco
**em silêncio**, sem redesenhar. Na aba **Jogos**: busca por nome, e o cabeçalho da tabela é
clicável pra ordenar por qualquer coluna (`jSort` persiste entre re-renders; ▲/▼ no header).

## `api/enrich.ts`

`GET /api/enrich?title=<wiki>&name=<jogo>` → `{ cover_url, critic_score, critic_source }`.
Capa: `en.wikipedia.org/api/rest_v1/page/summary`. Crítica: `api.rawg.io/api/games?search=`
(campo `metacritic`). `RAWG_API_KEY` fica só no servidor. Chamado só em ação do admin
(criar/editar jogo, botão "re-buscar"). CRUD permite override manual da nota.

## Loja (consoles à venda)

CRUD 100% manual, sem integração externa. `store_items`: `label`, `url` (link de afiliado),
`image_url`, `price`, `rating`, `sales`, `sort_order`, `active`.

Na home (antes do footer) vai só um **botão piscante** (`storeCtaHtml`) → `#/loja`, e só
aparece se algum `store_items` já tem `url`. A rota `#/loja` (`lojaView`) mostra o grid
(`storeSectionHtml`): cards dos itens ativos com `url`, ordenados por `sort_order` — foto,
`label`, preço, `nota★ · N vendidos`, botão "Veja a Oferta". No `#/admin` → **Loja**, o admin
edita tudo inline (salva no `blur`, sem redesenhar a tela), adiciona e exclui. Realtime.
Migration `0004` seeda 7 rótulos como ponto de partida; `0005` tirou as colunas da antiga
integração com a Shopee.

## Autenticação e e-mail

Login é **magic link** (`signInWithOtp`, `flowType: "implicit"`). O e-mail sai pelo **Resend**
(SMTP custom no Supabase, remetente `Game Club Retrô <clube@bf.dev.br>`, domínio verificado),
com rate limit de 100/h. O template vive versionado em `supabase/email-magiclink.html` e é
aplicado pelo painel (a Management API recusa o access token atual com 403).

A tela `#/entrar` trava o botão "MANDAR LINK" por 60s após o envio e traduz o erro de rate
limit — sem isso, cliques repetidos queimam a cota e voltam como "email rate limit exceeded".
Fora da allowlist, o hook `before-user-created` impede a criação da conta; membro novo entra
com o código de convite (`redeem_invite`) antes do `signInWithOtp`.

## Limitações conhecidas

- **RAWG e retrô:** alguns títulos JP-only não têm `metacritic` → override manual no CRUD.
- **`api/enrich` é aberta** (proxy de dados públicos). Baixo risco; cacheada 24h.
- **Sorteio no cliente** — ver ADR 0002.
- **Animação de slot** parece lenta se a aba do Chrome está em segundo plano (o navegador
  estrangula `setTimeout`). Com a aba na frente são ~2s.

## Indique seu jogo

Seção na home (`suggestionsSectionHtml`): membro logado sugere `title` + motivo; a lista é
pública. No `#/admin` → **Sugestões**, o admin **aceita** (com "+ criar jogo" que pré-preenche
o formulário de Novo Jogo) ou **recusa**, com um comentário opcional. Realtime.

## Excluir jogo

`#/admin` → Jogos → **excluir** (hard delete). Se o jogo já foi rodada, o FK
`rounds.game_id → games.id` bloqueia e a UI avisa pra deixar inativo em vez de excluir.
O toggle `ativo` continua: jogo inativo some da home e do sorteio, mas fica no admin.

## Como adicionar um jogo

Pelo **painel admin** (`#/admin` → Jogos → Novo jogo). Ou, em massa, editar
`scripts/gen-seed.mjs` e rodar `node scripts/gen-seed.mjs && node --env-file=.env.local
scripts/sql.mjs supabase/seed.sql` (upsert idempotente).

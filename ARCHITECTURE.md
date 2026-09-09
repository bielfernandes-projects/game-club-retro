# Arquitetura

## Visão geral

Um único arquivo estático: **`index.html`** contém markup, CSS e JavaScript inline, além dos
dados de todos os jogos. Sem build, sem framework, sem dependências instaladas.

Recursos externos (todos opcionais — o site degrada com elegância se falharem):

| Recurso | Origem | Uso |
|---|---|---|
| Fontes | `fonts.googleapis.com` (Press Start 2P, Chakra Petch) | tipografia |
| Capas | API MediaWiki de `pt.wikipedia.org` → fallback `en.wikipedia.org` | imagem da capa |
| Pôster do vídeo | `i.ytimg.com/vi/<id>/hqdefault.jpg` | thumbnail clicável |
| Player | `youtube-nocookie.com/embed/<id>` | trailer (só carrega ao clicar) |

## Modelo de dados

### `GAMES` — array de jogos (em `index.html`)

```js
{
  id: "suikoden2",          // slug único e estável (usado no localStorage)
  t:  "Suikoden II",        // título exibido
  c:  "PS1",                // chave de console (ver EMU)
  y:  1998,                 // ano
  yt: "rfAJ5a6V7KI",        // ID do vídeo no YouTube (11 chars)
  p:  "Guerra, política...",// pitch de uma linha
  series: "suikoden",       // opcional: identificador da saga
  order: 2                  // opcional: posição na saga (1 = primeiro)
}
```

### `EMU` — mapa console → emulador

Cada chave de console aponta para `{ name, url, label }`. `url` é sempre o site **oficial** do
emulador (link estável). `label` é o nome completo do console, usado nos badges e na busca de ROM.

Consoles suportados: `SNES` (Snes9x), `MD` (BlastEm), `N64` (Project64), `PS1` (DuckStation),
`GBA` / `GBC` (mGBA).

## Elegibilidade e travas de saga

`eligible()` retorna os jogos que podem ser sorteados agora:

1. Não está na lista "já jogamos" (`played`).
2. Se tem `series` e `order > 1`: **todos** os jogos da mesma `series` com `order` menor já
   precisam estar em `played`.

Sagas configuradas: `chrono` (Trigger → Cross), `suikoden` (I → II), `re` (1 → 2 → 3),
`pe` (Parasite Eve → II), `golden-sun` (→ The Lost Age), `mother` (EarthBound → Mother 3),
`metroid` (Super Metroid → Fusion). Metroid: Zero Mission fica de fora da saga (é remake do
Metroid 1, não continuação).

Ao sortear "outro", o candidato atual é excluído do próximo sorteio (a menos que seja o único
elegível). Quando `eligible()` fica vazio, a tela mostra "🏆 VOCÊS ZERARAM O CLUBE".

## Estado persistido

Chave única: **`localStorage["gcr_jogados_v2"]`** = array de `id`s dos jogos escolhidos.
É a única coisa persistida. Remover um `id` (via ✕ ou "desfazer") automaticamente re-tranca os
jogos posteriores da saga.

## Catálogo (accordion)

Um `<details>` nativo (fechado por padrão) lista **todos** os jogos, ordenados por ano.
`renderCatalog()` roda junto de `renderPlayed()` e marca cada linha: `✓` jogado (riscado),
`🔒` travado pela saga (com "depois de \<jogo\>") ou `•` disponível.

## Fluxo da interface

```
idle ──SORTEAR──▶ animação slot ──▶ candidato (capa + pôster + links + "escolhemos esse")
                                        │
                        ┌───────────────┼────────────────┐
               "sortear outro"   "escolhemos esse"        │
                        │               │                 │
                     novo candidato   commit():            │
                                      - push id em played  │
                                      - modal + confete     │
                                      - libera próximo da saga
                                        │
                              ┌─────────┴─────────┐
                          "bora jogar"     "desfazer escolha"
                          (fecha modal)    (remove id, reativa botão, fecha modal)
```

## Carregamento de mídia

**Capas** — `coverFor(game)` consulta a API MediaWiki (`generator=search` + `prop=pageimages`,
`piprop=thumbnail`, `origin=*` para CORS anônimo), primeiro na Wikipédia PT, depois na EN.
Resultado (URL ou `null`) é cacheado em memória por sessão. Sem imagem → placeholder com
console + ano.

**Trailer** — nunca carrega o `<iframe>` no load (isso dispara o erro 150/153, principalmente
via `file://`). Mostra um `<button>` com a thumbnail do YouTube; o clique troca pelo player com
`autoplay=1`. Um link direto "abrir trailer no YouTube ↗" fica sempre visível como plano B.

## Acessibilidade e movimento

- `prefers-reduced-motion` desliga o glow pulsante, a animação de slot (vira delay curto) e o confete.
- Modal: fecha no ✕, no botão, no `Esc` ou clicando fora; foco vai pro botão de fechar; `aria-modal`.
- Texto funcional ≥ 11px; badges e rótulos em Press Start 2P a 11px.

## Auto-verificação

O fim do `<script>` roda `console.assert` checando: emulador para todo console, `id`s únicos,
IDs de YouTube com 11 chars, ausência de PS2, montagem do modal e as travas de saga (incluindo
a de 3 níveis do Resident Evil). Abra o console do navegador para ver falhas.

## Deploy

Site estático no Vercel (preset "Other", sem build). Repositório ligado ao projeto: cada push
na `main` gera um deploy de produção. Domínio `gameclub.bf.dev.br` (DNS gerenciado pela Vercel).

## Limitações conhecidas

- **IDs de YouTube são fixos e escolhidos manualmente** — podem sair do ar ou ter o embed
  desabilitado pelo dono. O link "abrir no YouTube" mitiga; trocar o ID em `GAMES` resolve.
- **Busca de capa na Wikipédia** pode ocasionalmente errar o artigo ou não achar imagem →
  placeholder é exibido.
- **Links de ROM** são buscas no Google (`hl=pt-BR`), não links diretos — de propósito, porque
  link direto de ROM apodrece rápido.

## Como adicionar um jogo

1. Adicione um objeto ao array `GAMES` em `index.html` com um `id` novo e um `yt` real.
2. Para sequências, defina `series` (mesma string do jogo anterior) e `order`.
3. Confira no console do navegador que os `console.assert` continuam passando.

# 0002 — Sorteio ponderado roda no cliente, sem validação no servidor

**Status:** aceito · 2025

## Contexto

O sorteio calcula os jogos elegíveis (trava de saga, já-jogados) e faz uma escolha aleatória
ponderada pelo Destaque. Isso podia rodar numa Supabase Edge Function (à prova de
adulteração) ou no navegador do admin.

## Decisão

Rodar **no navegador do admin** (`src/data/draw.ts`). O que a RLS garante no servidor é só:
**quem** pode criar uma Rodada (só admin) e que existe **no máximo uma** Rodada ativa.

## Motivo

Só existe um admin, e é o dono do clube. Ele não tem incentivo pra "trapacear" o próprio
sorteio. Uma Edge Function seria mais uma peça pra manter (deploy, testes, versão) por um
ganho de integridade que ninguém precisa aqui.

## Consequências

- `draw.ts` é uma função pura, coberta por testes (`draw.test.ts`) — dá pra confiar na lógica
  sem servidor.
- **Caminho de upgrade:** se um dia houver mais de um admin, ou alguém contestar um sorteio,
  mover `draw.ts` (mais a leitura de `games`/`rounds`) pra uma Edge Function `POST /draw` que
  cria a Rodada. A assinatura da função já foi desenhada pra isso (recebe listas, devolve um
  jogo).

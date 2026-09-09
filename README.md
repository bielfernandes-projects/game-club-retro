# Game Club Retrô — Sorteador do Mês

Site de página única que sorteia **um clássico incontestável (modo história) por mês** para o
grupo Game Club Retrô jogar, zerar e discutir. Ao sortear, mostra a capa, o trailer e os links
pra baixar o emulador do console e a ROM (busca priorizando PT-BR).

**No ar:** https://gameclub.bf.dev.br

## Como funciona

- **Sortear jogo** → animação de slot machine → cai num *candidato* (nada é salvo ainda).
- **Escolhemos esse** → salva na lista do clube, abre um modal de comemoração com confete e
  libera o próximo jogo da saga (se houver). Dá pra **desfazer** — isso reativa o botão de escolher.
- **Sortear outro** → descarta o candidato e tira outro.
- A lista "Já jogamos" fica salva no navegador (`localStorage`); cada item tem ✕ pra desfazer,
  e há um "limpar tudo".
- O accordion **"Lista completa"** (fechado por padrão) mostra todos os jogos do sorteador,
  marcando os já jogados e os que estão travados esperando o anterior da saga.

### Regras da curadoria

- Só clássico **incontestável** com **campanha / modo história**.
- **Fora:** jogos de luta, kart, plataforma e Super Mario (ou similares).
- **Teto de console:** PlayStation 1. Também entram SNES, Mega Drive/Genesis, Nintendo 64,
  Game Boy Color e Game Boy Advance — todos mais leves de emular. **PSP não entra.**
- **Ordem das sagas:** um jogo numerado só entra no sorteio depois que o anterior for escolhido
  (ex.: Suikoden I antes do II; Resident Evil 1 → 2 → 3).

## Rodar localmente

Abra `index.html` no navegador. Para capas e embeds de vídeo funcionarem 100%, sirva por HTTP:

```bash
npx serve .
# ou
python -m http.server
```

Abrir direto como `file://` funciona, mas o navegador bloqueia as capas (CORS) e o YouTube
recusa o embed (erro 150/153) — por isso o site usa pôster clicável + link direto como plano B.

## Deploy

Estático no Vercel, sem build. Todo push na branch `main` publica automaticamente.

## Editar a lista de jogos

Toda a curadoria vive no array `GAMES` dentro de `index.html`. Veja
[ARCHITECTURE.md](ARCHITECTURE.md) para o schema de cada entrada e como as travas de saga funcionam.

## Estrutura

```
index.html        # o site inteiro: markup + CSS + JS + dados dos jogos
README.md
ARCHITECTURE.md   # decisões técnicas, modelo de dados, algoritmo de elegibilidade
```

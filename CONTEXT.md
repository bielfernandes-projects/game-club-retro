# Vocabulário — Game Club Retrô

Glossário do domínio. Só termos e o que eles significam; decisões de implementação ficam em
`ARCHITECTURE.md`.

## Jogo (Game)

Um título no catálogo. Tem console, ano, um _pitch_ de uma linha, um vídeo (trailer), uma
capa e uma **nota de crítica**. Pode estar em **Destaque** e pode estar **inativo**.

## Catálogo

A lista de todos os jogos **ativos**. Visível pra qualquer visitante, logado ou não.

## Destaque

Marca (estrela) que o **admin** coloca num jogo pra ele ter **peso 3×** no sorteio. É a única
forma de "viciar" o sorteio a favor de um jogo.

## Sorteio (Draw)

O ato — só do admin — de tirar ao acaso um jogo **elegível**, com o peso do Destaque contando.
O sorteio produz um **candidato**: o admin pode sortear de novo à vontade. Só quando ele
**confirma** o candidato é que nasce uma **Rodada**.

## Elegível

Um jogo pode ser sorteado se:

1. está **ativo**;
2. **nunca foi Rodada** (nenhuma rodada, em nenhum status, aponta pra ele);
3. se faz parte de uma **saga**, todos os antecessores da mesma saga já são **Rodadas
   arquivadas**.

## Saga

Uma sequência direta de jogos (ex.: Suikoden I → II; Resident Evil 1 → 2 → 3). Identificada
por um nome de série + um número de ordem. O clube joga na ordem: o nº 2 só entra no sorteio
depois que o nº 1 for **arquivado**.

## Rodada (Round)

Um mês do clube. Tem **um** jogo e um **status**:

- `jogando` — o clube está zerando o jogo;
- `avaliando` — o admin encerrou o mês; as **avaliações** estão abertas;
- `arquivada` — encerrada de vez; libera o próximo sorteio.

Só existe **uma** Rodada não-arquivada por vez. A transição entre status é sempre manual, do
admin (`encerrar o mês`, `arquivar`).

## Membro (Member)

Uma pessoa na **allowlist**, com papel `admin` ou `membro`.

- **admin** — sorteia, controla Rodadas, faz CRUD de jogos, gerencia a allowlist. Só há um
  (mas o modelo aceita mais).
- **membro** — vê tudo e **avalia**. Não sorteia.

Um visitante **deslogado** vê o catálogo, o jogo do mês e as avaliações — só não escreve nada.

## Allowlist

O conjunto de e-mails que o admin autoriza a entrar. Um e-mail **fora da allowlist não
consegue criar conta**. O admin cadastra só o e-mail; o nome cada pessoa edita no próprio
perfil no primeiro login.

## Avaliação (Review)

De um membro sobre uma Rodada: uma **nota** de 1 a 5 estrelas + uma **crítica** curta (≤ 280
caracteres). Uma por membro por Rodada, editável enquanto a Rodada está `avaliando`. Todo
mundo (logado ou não) lê; só membro escreve.

## Nota de crítica (Critic score)

A nota externa, estilo **Metacritic**, de 0 a 100. Vem da **RAWG** ou é preenchida à mão pelo
admin. **Não confundir** com:

## Média do clube

A média das **notas dos membros** (1 a 5) de uma Rodada. É o que o clube achou. Aparece no
catálogo, ao lado — e claramente separada — da nota de crítica externa.

## Já jogado

Um jogo que tem Rodada, em qualquer status. Sai do sorteio pra sempre (a menos que o admin
apague a Rodada direto no banco).

## Indicação (Suggestion)

Um jogo que um **membro** quer que entre na curadoria: um nome + um motivo opcional. Fica
`pendente` até o **admin** decidir — `aceita` (e aí o admin cadastra o jogo) ou `recusada`,
com um comentário opcional. Não é um Jogo até o admin criar.

## Inativo vs. excluído

Um Jogo **inativo** (`ativo = false`) some da home e do sorteio mas continua no painel admin —
é "fora de rotação por enquanto". **Excluir** apaga de vez; só dá se o jogo nunca foi Rodada.

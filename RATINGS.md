# Ratings e balanceamento

Relatório das mudanças de força aplicadas ao jogo. Os números de "antes" foram medidos
no próprio motor (`calculateTeamOverall`), não nas sementes soltas do arquivo de dados.

## O problema

| medida | antes | depois |
| --- | --- | --- |
| overall mínimo dos adversários | 86 | 77 |
| overall máximo dos adversários | 99 | 92 |
| média dos adversários | 94,5 | 84,5 |
| mediana dos adversários | 95 | 85 |
| melhor onze possível do usuário | 94 | 94 |
| onze montado por escolhas rápidas | 60 a 63 | 87 |

O melhor time que o usuário consegue montar chega a 94. A média adversária era 94,5, com
oito equipes acima de 96. Toda campanha começava perdida, e não por acaso: era desequilíbrio.

## Como a curva foi refeita

As sementes não foram cortadas por igual. Cada equipe recebeu um alvo pela posição que já
ocupava no ranking histórico do jogo, preservando a ordem de força:

```
alvo = 78 + (posição_no_ranking / 30) ^ 0,85 * 14
semente = alvo - bônus_interno_do_time
```

O expoente 0,85 espalha mais os times fracos e comprime o topo, criando quatro faixas
naturais: irregulares (77 a 81), bons (82 a 85), fortes (86 a 89) e lendários (90 a 92).

### Antes e depois, por equipe

| equipe | antes | depois |
| --- | --- | --- |
| Cruzeiro 2003 | 98 | 92 |
| Flamengo 2019 | 99 | 92 |
| Flamengo 1981 | 98 | 91 |
| São Paulo 1992 | 98 | 91 |
| Santos 1962 | 97 | 90 |
| Grêmio 2017 | 97 | 90 |
| Palmeiras 2021 | 98 | 90 |
| Internacional 1979 | 97 | 89 |
| Corinthians 1999 | 97 | 89 |
| Vasco 2000 | 96 | 88 |
| São Paulo 2005 | 96 | 88 |
| Palmeiras 1972 | 96 | 87 |
| Palmeiras 1993 | 95 | 87 |
| Internacional 2006 | 96 | 87 |
| Corinthians 2012 | 95 | 86 |
| Fluminense 2023 | 95 | 86 |
| Grêmio 1995 | 95 | 85 |
| Vasco 1998 | 95 | 85 |
| Grêmio 1983 | 94 | 84 |
| Santos 2002 | 94 | 84 |
| Cruzeiro 2014 | 94 | 84 |
| Internacional 1975 | 93 | 83 |
| Cruzeiro 1997 | 93 | 83 |
| Botafogo 1968 | 93 | 82 |
| Fluminense 2010 | 93 | 82 |
| São Paulo 1986 | 92 | 81 |
| Vasco 1989 | 91 | 81 |
| Athletico Paranaense 2001 | 90 | 80 |
| Bahia 1988 | 89 | 79 |
| Corinthians 1990 | 89 | 79 |
| Coritiba 1985 | 86 | 78 |

A faixa está travada por teste (`src/lib/balance.test.ts`): nenhuma equipe pode sair de
76 a 93, a média precisa ficar entre 82 e 87 e a chave precisa manter pelo menos cinco
times abaixo de 82 e três acima de 89.

## Curva progressiva de dificuldade

A faixa 77–92 já estava calibrada, mas a chave era sorteada sem ordem: dava para pegar o
Flamengo 2019 nas oitavas e o Coritiba 1985 na final. `createBracket` agora distribui o
sorteio por faixas de força, de modo que os mais fortes ficam presos na metade oposta e só
podem ser encontrados no fim.

Força média do adversário enfrentado em cada fase, medida sobre 400 campanhas:

| fase | antes (sorteio livre) | depois |
| --- | --- | --- |
| oitavas | 84,5 | 77,7 |
| quartas | 84,5 | 79,7 |
| semifinal | 84,5 | 82,7 |
| final | 84,5 | 89,3 |

Taxa de título por qualidade do onze montado, sobre 300 campanhas simuladas sem forçar
resultado:

| onze do usuário | títulos | eliminação nas oitavas |
| --- | --- | --- |
| overall 96 (melhor possível) | 55,7% | 5% |
| overall 92 (bom) | 34,7% | 8% |
| overall 86 (irregular) | 12,0% | 13% |

A curva está travada por `bracket.test.ts`, que falha se a força média das faixas deixar de
subir de uma fase para a outra.

## O que mudou nos elencos do Galo

Nenhum overall de jogador do Atlético foi alterado nesta rodada. A base tem 306 atletas,
com média 83,8 e faixa de 74 a 95, que já é compatível com a curva adversária nova.

Uma equivalência foi cadastrada: **lateral cobre ala e ala cobre lateral**
(`withFlankCover`, em `src/data/atletico-squads.ts`). Sem ela, o 3-5-2 ficava sem nenhum
jogador elegível para as vagas de ala em 13 dos 17 elencos, e a regra de posição
compatível travava a campanha. `src/lib/coverage.test.ts` verifica toda vaga de toda
formação contra todo elenco.

## Base estruturada e relatório de confiança

A base agora carrega, por atleta, os campos pedidos: nome, temporada, posição primária e
secundária, atributos utilizados, overall, **nível de confiança**, **justificativa** e
**referência**. A estrutura está em `RatingEvidence` (`src/types/game.ts`) e é preenchida
por `evidenceFor` em `src/data/atletico-squads.ts`.

A referência aponta para o registro do próprio elenco na base (`base interna · <elenco>`).
Nenhuma fonte externa foi citada, porque nenhuma foi conferida: inventar bibliografia para
306 atletas seria pior do que admitir a lacuna. `ratings.test.ts` falha se qualquer `source`
virar uma URL.

A confiança é derivada de sinais que a base realmente possui, e não de opinião:

| confiança | critério | atletas |
| --- | --- | --- |
| alta | característica própria registrada **e** titular em elenco com conquista declarada | 25 |
| média | um dos dois sinais | 65 |
| baixa | nenhum sinal: o overall é estimativa | 216 |

Total de 306 atletas, faixa de 74 a 95, média 83,8. **Nenhum overall foi alterado.** Mexer
nos números sem medir o efeito na chave quebraria a faixa travada por `balance.test.ts`, e
a auditoria (`src/lib/ratings.ts`) é somente leitura de propósito.

### Achados da auditoria

Rodada por `auditRatings()`, verificada por `src/lib/ratings.test.ts`.

**Ratings discrepantes** (fora de dois desvios na mesma posição e década) — 1 caso:

- Gérson 1995, atacante: 76 contra média 85,1 dos atacantes dos anos 90 (desvio 4,3).

**Jogadores com pouca informação** — 216 de 306 (71%). É a maior lacuna da base: são
reservas e atletas sem característica registrada, cujo overall é estimativa. O número alto
é o resultado honesto do critério, não um defeito do relatório.

**Reservas com overall alto demais** (fora dos onze, a um ponto ou menos do titular da
mesma função) — 2 casos:

- Alfinete 1977, lateral: 82 contra Ângelo (83).
- Paulo César 1995, lateral: 79 contra Paulo Roberto (80).

**Ídolos com overall abaixo do esperado** — nenhum caso. Todo atleta com característica de
ídolo registrada pontua acima da média do próprio elenco.

**Diferenças injustificadas entre jogadores da mesma posição e era** (salto de 10 pontos ou
mais entre vizinhos diretos) — 15 casos, concentrados em dois padrões:

- Goleiro reserva: Careca 1971 (−10 para Renato), Montezuma 1980 (−12), Gaspar 1985 (−11),
  Milagres 1995 (−12) e 1997 (−10), Giovanni 2012 (−13), 2013 (−16) e 2014 (−14).
- Centroavante reserva: Lola 1969 (−10) e 1971 (−12), Campos 1976 (−12), 1977 (−14) e
  1980 (−17 para Reinaldo).
- Zaga: Rafael Marques 2013 (−10 para Leonardo Silva).

O padrão é consistente: a base separa muito o titular histórico do reserva nas posições de
um jogador só (gol e centroavante). Isso é defensável como desenho, mas explica por que o
sorteio de um ano ruim pesa tanto na escalação.

## Revisão pendente dos ratings individuais

A reconstrução completa pedida (atributos por posição, overall recalculado, nível de
confiança, justificativa e fontes por atleta) não foi feita nesta rodada e não deve ser
improvisada: sem cruzar referências históricas públicas, atribuir "confiança alta" a 306
jogadores seria inventar precisão. O caminho combinado está em `NEXT_STEPS.md`.

Pontos que a auditoria já sinaliza para revisão manual:

- 2 atletas acima de 94 e 61 na faixa 75 a 79: a cauda de baixo concentra reservas que
  hoje ficam perto demais de titulares históricos da mesma posição.
- Elencos recentes (2020 a 2024) tendem a pontuar acima de elencos dos anos 70 e 80 com
  papel equivalente, efeito de memória recente e não de força relativa.
- Goleiros usam o mesmo perfil de atributos em todas as eras, o que achata a diferença
  entre um ídolo e um titular passageiro.

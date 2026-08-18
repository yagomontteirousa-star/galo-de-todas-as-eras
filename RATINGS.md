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

## O que mudou nos elencos do Galo

Nenhum overall de jogador do Atlético foi alterado nesta rodada. A base tem 306 atletas,
com média 83,8 e faixa de 74 a 95, que já é compatível com a curva adversária nova.

Uma equivalência foi cadastrada: **lateral cobre ala e ala cobre lateral**
(`withFlankCover`, em `src/data/atletico-squads.ts`). Sem ela, o 3-5-2 ficava sem nenhum
jogador elegível para as vagas de ala em 13 dos 17 elencos, e a regra de posição
compatível travava a campanha. `src/lib/coverage.test.ts` verifica toda vaga de toda
formação contra todo elenco.

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

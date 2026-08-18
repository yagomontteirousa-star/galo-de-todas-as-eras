# NEXT_STEPS

Progresso do refinamento pedido em 18/08/2026. Cada bloco abaixo foi commitado e validado.

## Concluído

- **Regras**: posição só primária ou secundária, com bloqueio, shake na vaga e aviso curto.
  Lateral e ala viraram equivalentes para o 3-5-2 não travar (`coverage.test.ts`).
- **Balanceamento**: adversários remapeados de 86 a 99 (média 94,5) para 77 a 92
  (média 84,5). Relatório completo em `RATINGS.md`, faixa travada por `balance.test.ts`.
- **Sorteio**: o elenco não é renderizado durante o giro dos anos, nem borrado.
- **Cabedal**: "Tenho cabedal" (sem overall) e "Quero uma ajuda" (com overall).
- **Seleção**: cards sem subtítulo, overall junto do nome, sem filtros, painel central de
  1180px no desktop, largura cheia no mobile.
- **Mobile**: rolagem suave lista, campo, posição, lista, com abas para não exigir scroll longo.
- **Simulação**: timeline de 4 linhas com fade, cores por tipo de lance, animação de gol no
  placar, controles de pausa e velocidade começando lento.
- **Pênaltis**: cobrança a cobrança, com cobrador, placar parcial, sequência e parada quando
  o resultado fica matematicamente definido.
- **Telas finais**: relatório de campanha para vitória e eliminação com fase, vitórias,
  overall, formação, perfil, resultados, anos enfrentados, melhores nomes com barra de força
  e botão de compartilhar (Web Share API com cópia como alternativa).
- **Home**: painel central, estados de primeira visita, campanha ativa e encerrada, histórico
  em cards, campo com ídolos reais da base e vagas em aberto.
- **Marca**: logo oficial no favicon, header, carregamento e telas finais. Faixa
  "Desenvolvido por" com a logo branca da Master Digital na home e nas telas finais.

## Pendente

1. **Variação posicional por perfil tático** (item 4). O perfil já muda a simulação; falta
   deslocar as linhas no campo (defensivo mais recuado, ofensivo mais adiantado) com
   transição curta. Onde mexer: `formations.ts` (offsets por tática) e `Pitch.tsx`.
2. **Base estruturada de ratings do Atlético** (item 11). Exige cruzar referências
   históricas públicas por atleta e marcar confiança baixa onde não houver dado. Escopo e
   pontos de atenção em `RATINGS.md`.
3. **Link da Master Digital**: a faixa está sem href porque a URL oficial não foi informada.

## Publicar

O projeto Vercel não está ligado ao GitHub, então o push sozinho não publica:

```
npx vercel deploy --prod
```

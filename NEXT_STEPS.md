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

- **Variação posicional por perfil tático**: `tacticalSlots` em `formations.ts` desloca as
  linhas por setor, o `Pitch` renderiza com transição de 320ms e `tactics.test.ts` garante
  que a estrutura, a contagem e o goleiro não mudam.
- **Rodapé**: logo branca oficial da Master Digital em SVG, vinda do brand kit.

### Rodada de 18/08/2026 (segunda revisão)

- **Marcadores do campo**: o botão virou um disco compacto com a sigla da posição centrada
  e nada mais; nome e overall saíram para uma etiqueta com fundo próprio logo abaixo. Nome
  longo cai para o sobrenome e reduz a fonte, com ellipsis como último recurso.
- **Ano do time do usuário**: `eraLabel` substitui o "2026" por "Seleção histórica" na
  chave, no placar, na simulação, no resultado e no compartilhamento.
- **Lances por posição**: os seletores de jogador agora filtram por função (`pickByRole`) e
  cada família de lance tem frase própria por posição. Goleiro só aparece em reposição e
  defesa; `simulation.test.ts` falha se ele voltar a "subir a pressão".
- **Histórico da home**: o card ganhou placar da queda, adversário, vitórias, overall e
  formação, tudo vindo de `CampaignRecord`.
- **Tela final**: composição centrada em 1220px, três blocos (destaques, onze completo,
  campanha), placar em evidência no topo e marcação visual para os quatro melhores e para
  os atletas com característica própria. O compartilhamento tem três camadas de fallback.
- **Metadados sociais**: `og:*` e `twitter:*` completos com `metadataBase` em
  `pretonobranco.app`, mais `opengraph-image`/`twitter-image` geradas em 1200×630.
- **Marca**: redução vetorial (`PnbGlyph`) para header e favicon, porque a arte com
  respingos vira mancha abaixo de ~46px. A arte original segue nos tamanhos grandes.
- **Curva de dificuldade**: `createBracket` distribui a chave por faixas de força. Números
  medidos em `RATINGS.md`, travados por `bracket.test.ts`.
- **Base de ratings**: `RatingEvidence` com confiança, justificativa e referência interna
  para os 306 atletas, mais `auditRatings()` e o relatório em `RATINGS.md`. Nenhum overall
  foi alterado.

### Rodada de 18/08/2026 (terceira revisão)

- **Intervalo**: o painel ocupa o lugar do placar. Relógio, placar e controles saem de cena,
  a simulação congela, o segundo tempo só começa depois de uma postura escolhida e o botão
  de seguir mora dentro do painel. Acontece uma vez só.
- **Atleta único por campanha**: `personId` (`src/data/player-identity.ts`) dá ao jogador
  uma identidade que atravessa os anos, com tabela de apelidos (Cerezo, Romeu, Éder) e de
  homônimos que são pessoas diferentes (Bruno, Paulinho, Adilson e outros). O sorteio de
  ano também passou a evitar elencos sem ninguém aproveitável, para a campanha não travar.
- **Compartilhamento entre aparelhos**: rota `/c/[payload]` com a campanha inteira embutida
  no link em base64url. Não depende do armazenamento de quem jogou, valida o payload e cai
  numa mensagem amigável quando o link chega cortado.
- **Capa OG**: banner 1200×630 centrado, prancheta branca e o nome, sem dado variável. É a
  mesma capa no link comum e no link de campanha.
- **Mensagens dinâmicas**: título e descrição mudam por resultado (campeão, vice,
  eliminado), sempre com fase, adversário e ano reais.

### Rodada de 18/08/2026 (quarta revisão)

- **Pênaltis no lugar da timeline**: a disputa substitui os últimos lances na mesma região,
  em duas colunas (uma por equipe), com ponto de convertida, cobrador e placar parcial. Sem
  `overflow`, sem `max-height`: as 12 cobranças do pior caso cabem inteiras. A última
  cobrança pisca uma vez, a morte súbita ganha marca própria e a série completa fica 2,2s na
  tela antes de liberar o resultado.
- **Timeline invertida**: o lance mais novo entra no topo e o mais antigo desce até sair com
  fade. A correção é na ordenação (`reverse()`), não no CSS, e o fade migrou para o último
  item da lista.
- **Link compacto**: o payload virou texto delimitado (fases, formações e perfis como
  índices, ano como deslocamento, sigla da vaga derivada da formação) e passa por
  `CompressionStream("deflate-raw")`, nativo no navegador e no Node. Uma campanha de quatro
  jogos sai em ~281 a 340 caracteres, contra ~740 do formato anterior.
- **Três formatos convivem**: `3` comprimido (padrão), `2` texto puro (onde não houver
  compressão) e sem prefixo o JSON dos primeiros links. Link antigo real está travado por
  teste e continua abrindo.

## Pendente

1. **Revisão dos overalls individuais**: a estrutura existe, mas 216 dos 306 atletas estão
   marcados como confiança baixa. Subir isso exige cruzar referências históricas reais, não
   dá para derivar da própria base. Achados priorizados em `RATINGS.md`.
2. **Link da Master Digital**: a faixa vira link assim que
   `NEXT_PUBLIC_MASTER_DIGITAL_URL` for definida. Sem a variável, ela continua sem href —
   não chutamos um domínio.

## Publicar

O projeto Vercel não está ligado ao GitHub, então o push sozinho não publica:

```
npx vercel deploy --prod
```

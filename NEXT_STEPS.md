# NEXT_STEPS

Registro curto de progresso para retomar o trabalho sem perder contexto.

## Concluído (commitado)

- **Cards do elenco**: sem subtítulo. Apenas posição, nome e overall (mais um selo "sem vaga" quando o atleta não cabe em nenhuma vaga aberta).
- **Destaque de posições**: ao selecionar um atleta, só as vagas compatíveis acendem (`is-slot-target`, `slot-in` + `slot-pulse`); as demais ficam apagadas.
- **Bloqueio de posição incompatível**: `assignPlayer` recusa qualquer vaga fora de primária/secundária, com shake na vaga (`is-slot-rejected`) e toast de erro. Nada é removido.
- **Cobertura garantida**: lateral e ala viraram equivalentes (`withFlankCover` em `atletico-squads.ts`), senão o 3-5-2 travava sem ala cadastrado. Trava coberta por `src/lib/coverage.test.ts`.
- **Revelação do ano**: giro de ~820ms entre os anos antes de parar no elenco sorteado; respeita `prefers-reduced-motion`.
- **Painel central do draft (desktop)**: `min(1180px, 100%)` centralizado, com borda e respiro lateral.
- **Tipografia**: Barlow (corpo) + Barlow Condensed (rótulos, abas, placares) via `next/font/google`; Archive segue no display.
- **Amarelo-estrela** (`--star: #f5c542`) como destaque pontual: assinatura da home, selo de era, passos do "como funciona", fase atual, aba ativa, velocidade ativa, confronto atual na chave, overall do elenco, vagas acesas.

## Próximo passo

1. Revisão visual final em desktop amplo (1920) e mobile (390) — sem regressão em seleção, troca de posição e confirmação.
2. `npm run typecheck && npm run lint && npm test && npm run build`.
3. Publicar: `npx vercel deploy --prod` (o projeto **não** está ligado ao GitHub; push sozinho não publica).

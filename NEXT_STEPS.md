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

- **Revisão final**: 1920×1080 e 390×844 auditados. No mobile o painel do draft voltou a ocupar 100% da largura (`width: auto` resolvia como shrink-to-fit; agora é `width: 100%`).

## Estado

Solicitação concluída e publicada. Validações: typecheck, lint, 18 testes e build — todos verdes.

## Se for retomar

Publicar exige a CLI, porque o projeto Vercel **não** está ligado ao GitHub (push sozinho não publica):

```
npx vercel deploy --prod
```

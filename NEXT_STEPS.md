# NEXT_STEPS

Rodada de 18/08/2026. Tudo abaixo está commitado, validado e publicado.

## Concluído nesta rodada

- **Corte atrás do header**: `.report-card` centralizava com `justify-content` numa caixa
  menor que o conteúdo, então o excesso se dividia e o título ficava atrás do cabeçalho com
  `scrollTop` já em zero. Centralização agora vem de margens automáticas no primeiro e no
  último filho. Medido: título a 126px com header terminando em 64px.
- **Volta ao resultado**: a chave aberta de uma campanha encerrada tem "Voltar ao resultado".
- **Simulação**: painel de lances com altura de exatamente quatro linhas, ancorado na base,
  duas para o intervalo; colunas terminando na mesma base; box score em painel escuro.
- **Chave**: abas de fase no celular, uma fase por vez; fases futuras discretas no desktop.
- **Cabeçalho mobile**: fase, escalação e overall; formação e sorteios só no desktop.
- **Cartão de fase**: "Vice-campeão" e "Pressão alta" com fonte de corpo, sem estourar.
- **Toque**: hover só em ponteiro fino e limite de arrasto de 10px na lista de atletas.
- **Rodapé**: faixa inteira é link para masterdigital.dev, alvo de 44px.

## Links curtos: falta provisionar o store

O código está pronto e ligado. `src/lib/share-store.ts` fala com qualquer store compatível
com a API REST do Upstash, que é o que a Vercel injeta ao conectar um KV, lendo
`KV_REST_API_URL` e `KV_REST_API_TOKEN`. A rota `POST /api/c` grava o snapshot imutável e
devolve um id de dez caracteres; `/c/[id]` lê do servidor sem depender de `localStorage`,
e ainda abre os links longos já enviados.

Enquanto o store não existir, `/api/c` responde 501 e o botão devolve o link longo, que
funciona. Ninguém copia endereço quebrado.

Para ligar, no painel da Vercel:

> Storage → criar KV (ou Upstash Redis) → conectar ao projeto `galo-de-todas-as-eras`

Nada mais precisa ser mexido no código. Depois de conectar, rode `npx vercel deploy --prod`
e todo link novo já sai no formato `https://pretonobranco.app/c/Ab3xK9mQ`.

## Pendente

1. **Store do KV** acima.
2. **Arte da tela de campeão**: a foto está no fundo com gradiente, mas ainda falta o
   tratamento pedido de manter coreto e silhueta livres, com painel estreito à esquerda e
   detalhes secundários em accordion.
3. **Base estruturada de ratings**: congelada a pedido. Contexto em `RATINGS.md`.

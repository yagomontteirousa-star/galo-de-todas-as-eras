---
name: "Preto no Branco"
description: "Arquivo histórico e prancheta de jogo para montar um onze impossível e disputar um mata-mata brasileiro."
colors:
  ink: "#0a0b0b"
  graphite: "#111313"
  panel: "#171918"
  line: "#303431"
  paper: "#f1efe7"
  paper-dim: "#c8c7c0"
  muted: "#999d98"
  gold: "#b99a59"
  gold-pale: "#d7c38e"
  star: "#f5c542"
  pitch-green: "#163c2b"
  danger: "#e49a80"
  success: "#99caaa"
typography:
  display:
    fontFamily: "Archive, Georgia, serif"
    fontWeight: 400
    lineHeight: 0.9
  body:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
rounded:
  compact: "5px"
  control: "8px"
  field: "10px"
  panel: "12px"
spacing:
  tight: "6px"
  control: "8px"
  panel: "12px"
  section: "22px"
components:
  button-primary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    height: "46px"
    rounded: "{rounded.control}"
  player-row:
    backgroundColor: "transparent"
    textColor: "{colors.paper}"
    minHeight: "54px"
  pitch-player:
    backgroundColor: "#0d241a"
    textColor: "{colors.paper}"
    rounded: "{rounded.field}"
  match-summary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
  campaign-strip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "7px"
---

# Design System: Preto no Branco

## Visão

**Norte criativo: A Súmula Viva**

Preto no Branco combina a materialidade de uma súmula impressa com a precisão de uma prancheta de transmissão. O resultado é uma interface editorial, compacta e escura, com números fortes, linhas finas e um campo que funciona como área de decisão.

O preto e o grafite estruturam a experiência. O branco cria contraste decisivo. O dourado marca tempo, progresso e conquista. O amarelo mais vivo é reservado a ações e momentos que exigem atenção. O verde pertence ao campo e a estados positivos pontuais.

## Tipografia

- **Archive:** títulos, anos, placares, ratings e desfechos.
- **Segoe UI e sistema:** textos, decisões, explicações e leitura contínua.
- **Barlow Condensed:** rótulos, fases, posições, filtros e chamadas curtas.
- **Piso de leitura:** nenhum texto funcional abaixo de 11px.
- Nomes e descrições devem quebrar naturalmente quando necessário, sem sobreposição ou scroll horizontal.

## Layout

- Desktop começa em 921px. Mobile termina em 920px.
- Telas operacionais podem rolar verticalmente quando a altura disponível não comportar o conteúdo.
- A home busca caber na primeira dobra em desktops comuns, mas nunca corta conteúdo para forçar esse resultado.
- Em notebook baixo, reduzir margens, vazios e elementos decorativos antes de reduzir fonte.
- No mobile, empilhar o fluxo e preservar a ordem da ação principal.
- Grades usam `minmax(0, 1fr)` e filhos usam `min-width: 0` para impedir vazamento.
- Nenhuma tela usa `transform: scale()` como solução de responsividade.

## Hierarquia por área

### Home

Marca, título, ação principal e campo dominam. Etapas e rodapé vêm depois e nunca se sobrepõem. A ação de começar campanha tem prioridade sobre a revisão da última campanha.

### Setup e draft

O campo é a área central de decisão. Lista, campo e controles mantêm densidade editorial. No mobile, abas organizam o conteúdo sem comprimir três colunas.

### Partida

Placar e ação principal ficam altos. Controles ocupam uma linha própria. Timeline e contexto dividem a primeira linha de conteúdo no desktop. O resumo da partida ocupa um card horizontal abaixo, com placar, gols, posse, finalizações, finalizações no alvo e leitura simples de pressão.

### Intervalo e decisões

A decisão fica acima de informações secundárias. O jogo comunica prazo, escolha e consequência sem esconder a ação de continuar.

### Chave e resultado

A chave usa visão por fase no mobile. O resultado final prioriza placar, destaques, compartilhamento e nova campanha. Jogos e elenco podem expandir no fluxo sem cobrir o resultado.

## Componentes

### Botões

Altura mínima de 44px, normalmente 46px. O primário usa papel claro sobre fundo escuro. Ações secundárias usam grafite e borda fina. Foco tem contorno dourado claro de 2px.

### Campo e atletas

O campo usa verde profundo e uma única sombra material. Cada atleta ocupa uma ficha compacta própria. Nome, posição e rating nunca invadem a posição vizinha. Seleção natural usa verde; improvisação usa amarelo com texto de apoio.

### Timeline

Exibe até quatro lances, do mais novo para o mais antigo. Ícones vetoriais identificam a ação. Gol do Galo recebe destaque dourado; gol rival permanece neutro. Texto pode quebrar, mas nunca usa corte com reticências na descrição.

### Resumo da partida

Card escuro e horizontal no desktop, compacto no mobile. O placar é o foco. Estatísticas são secundárias. Não repete nome, elenco ou escudo já visíveis no cabeçalho do confronto.

### Rodapé

Permanece no fluxo após o conteúdo. Texto e logo da Master Digital formam um único link com área de toque confortável.

## Movimento

Transições de estado usam 160 a 220ms. Movimento contínuo só aparece quando comunica atividade real. Nenhuma atualização do relógio pode reiniciar animações de timeline ou placar. `prefers-reduced-motion` reduz ou remove efeitos não essenciais.

## Regras

- O dourado pontua, não preenche grandes superfícies.
- O campo é funcional e central.
- Painéis são planos por padrão. Profundidade vem de linhas e contraste tonal.
- Alvos de toque têm pelo menos 44px.
- O layout deve funcionar a 100% de zoom sem exigir ajuste manual.
- Scroll vertical é aceitável quando necessário. Scroll horizontal e conteúdo cortado não são.
- O multiplayer permanece visualmente preservado no código, mas a rota pública mostra apenas o estado de pausa.

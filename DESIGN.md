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
  pitch-green: "#163c2b"
  danger: "#e49a80"
  success: "#99caaa"
typography:
  display:
    fontFamily: "Archive, Georgia, serif"
    fontSize: "clamp(68px, 7.5vw, 118px)"
    fontWeight: 400
    lineHeight: 0.77
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Archive, Georgia, serif"
    fontSize: "clamp(38px, 4vw, 62px)"
    fontWeight: 400
    lineHeight: 0.95
  title:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.1
  body:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "9px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.1em"
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
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 17px"
    height: "42px"
  button-quiet:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 17px"
    height: "42px"
  filter-chip-selected:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.compact}"
    padding: "0 8px"
    height: "27px"
  player-row:
    backgroundColor: "transparent"
    textColor: "{colors.paper}"
    rounded: "0"
    padding: "3px 12px"
    height: "38px"
  pitch-player:
    backgroundColor: "#0d241a"
    textColor: "{colors.paper}"
    rounded: "{rounded.field}"
    padding: "5px 7px"
    width: "62px"
  campaign-strip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "7px"
    padding: "5px 10px"
  paper-box-score:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "0"
    padding: "14px 15px 8px"
---

# Design System: Preto no Branco

## Overview

**Creative North Star: "A Súmula Viva"**

Preto no Branco transforma arquivo histórico em decisão instantânea. O mundo combina a materialidade de uma súmula impressa com a precisão de uma prancheta de transmissão: superfícies grafite, linhas finas, números monumentais e um campo que funciona como interface central.

A composição é editorial, densa e deliberadamente assimétrica, mas a operação permanece direta. O papel off-white cria momentos de contraste decisivo; o verde fica reservado ao campo; o dourado pontua eras, progresso e conquista sem virar decoração. A identidade recusa o dashboard corporativo genérico, o excesso de cartões flutuantes e a landing longa como estrutura de produto.

**Key Characteristics:**

- Súmula editorial de alta densidade.
- Campo funcional como centro da decisão.
- Contraste entre grafite fosco e papel off-white.
- Dourado raro para tempo histórico e conquista.
- Informação tabular compacta, legível e responsiva.

## Colors

A paleta parte do grafite quase preto, abre áreas de leitura em papel off-white, reserva o verde profundo ao campo e usa dourado envelhecido como pontuação discreta.

### Primary

- **Papel de Súmula:** superfície de alto contraste para CTAs selecionados, box scores e folhas de resultado.
- **Tinta de Arquivo:** fundo estrutural, texto sobre papel e contraste máximo.

### Secondary

- **Ouro de Era:** marca anos, progresso, conquistas e pequenas ênfases históricas.
- **Ouro Pálido:** reforça estados atuais, ratings e foco sem dominar a tela.

### Tertiary

- **Campo Profundo:** único grande bloco cromático; identifica o espaço tático e nunca vira cor genérica de painel.

### Neutral

- **Grafite Fosco:** superfície operacional dominante.
- **Painel de Cabine:** separa regiões densas por mudança tonal sutil.
- **Linha de Prancheta:** estrutura grades, tabelas e divisórias.
- **Papel Atenuado:** texto secundário de alta legibilidade.
- **Cinza de Arquivo:** metadados, rótulos e estados futuros.
- **Êxito e Alerta:** verde-claro e salmão comunicam encaixe e improvisação com apoio textual.

**The Ouro é Pontuação Rule.** O dourado marca tempo, progresso ou conquista; nunca preenche grandes superfícies nem compete com o campo.

## Typography

**Display Font:** Archive (with Georgia, serif fallback)
**Body Font:** Segoe UI (with Arial, sans-serif fallback)

**Character:** Archive dá peso histórico a títulos, anos, placares e ratings; Segoe UI mantém controles, tabelas e explicações rápidos de ler. A relação é de contraste entre memória editorial e operação contemporânea.

### Hierarchy

- **Display** (400, responsive clamp, 0.77 line-height): heróis, desfechos e números monumentais.
- **Headline** (400, responsive clamp, 0.95 line-height): títulos de tela e chamadas de fase.
- **Title** (700, 16px, 1.1 line-height): nomes de era e títulos operacionais compactos.
- **Body** (400, 15px, 1.4 line-height): explicações e narrativa corrente.
- **Label** (700, 9px, 0.1em letter-spacing, uppercase where structural): metadados, filtros, fases e legendas.

**The Archive Faz História Rule.** Use Archive somente em títulos, anos, placares, selos e ratings; toda operação e leitura contínua permanece em Segoe UI/Arial/system.

## Layout

O desktop é uma experiência contida em um viewport, com cabeçalho baixo de 58px e superfícies densas sem rolagem da página. O draft usa três colunas reais — elenco à esquerda (`minmax(320px, .85fr)`), campo dominante ao centro (`minmax(420px, 1.2fr)`) e súmula/ação à direita (`minmax(270px, .72fr)`) — separadas por linhas finas, não por cartões soltos.

O breakpoint estrutural é explícito: desktop começa em 921px; mobile termina em 920px. Em 920px ou menos, o documento volta a rolar, o draft vira três abas empilhadas (Elenco, Campo, Time), o header reduz para 54px e a ação principal fica fixa na base. Entre 921px e 1180px, as três colunas permanecem, mas comprimem suas mínimas e removem detalhes secundários. O ritmo usa intervalos compactos de 6–12px dentro de controles e 20–46px nas margens de tela.

**The Campo no Centro Rule.** No draft desktop, preserve sempre a leitura elenco → campo → súmula/ação; no mobile, preserve a mesma sequência por abas e mantenha o campo como aba inicial.

## Elevation & Depth

O sistema é plano e estrutural: profundidade vem de contraste tonal, linhas de 1px e alternância entre grafite e papel. A única sombra material recorrente pertence ao campo, que recebe `0 16px 40px rgba(0,0,0,.22)` para parecer uma prancheta física acima do fundo. Hover em botões usa deslocamento de 1px e mudança de borda, não sombra.

### Shadow Vocabulary

- **Campo elevado** (`0 16px 40px rgba(0,0,0,.22)`): aplicado exclusivamente ao retângulo do campo.

**The Flat-by-Default Rule.** Painéis e controles ficam planos; use linha, tom e estado antes de adicionar qualquer sombra.

## Shapes

As formas são compactas e utilitárias. Controles usam cantos de 5–8px, fichas e o campo chegam a 10px, e agrupamentos maiores podem usar 12px. Folhas de súmula e resultados permanecem retangulares, reforçando o contraste entre papel impresso e interface digital. Bordas finas de 1px são o principal instrumento de agrupamento.

## Components

### Buttons

- **Shape:** retângulo compacto com cantos controlados, altura mínima de 42px e padding horizontal de 17px.
- **Primary:** papel off-white sobre tinta preta; no box score claro, a relação se inverte para tinta sobre papel.
- **Hover / Focus:** elevação de 1px, borda mais clara e foco global de 2px em ouro pálido; estados desabilitados usam opacidade de 0.38.
- **Quiet:** grafite com texto off-white e borda fina; serve ações secundárias sem competir com o fluxo.

### Chips

- **Style:** filtros compactos de 27px, fundo tinta e borda de linha.
- **State:** o selecionado vira papel com texto preto; o rótulo nunca depende apenas da cor.

### Cards / Containers

- **Player Row:** linha de tabela clicável com posição, identidade, encaixe, rating e confirmação; seleção troca a linha inteira para papel.
- **Paper Box Score:** folha clara sem raio, cabeçalho com regra preta de 2px e métricas em grade.
- **Pitch Player:** ficha verde-escura de 62px sobre o campo; rating em Archive e bordas semânticas para encaixe natural, secundário ou improvisado.
- **Campaign Strip:** faixa compacta segmentada, com rótulos de 7–9px e numerais tabulares.

### Navigation

O cabeçalho é baixo e contínuo. Marca, estado da campanha, progresso de fases e ação textual ocupam uma única faixa no desktop; no mobile, o nome extenso e dados menos importantes desaparecem, mantendo monograma, estado essencial e reinício.

## Do's and Don'ts

### Do:

- **Do** preserve o campo como interface funcional e centro visual da tomada de decisão.
- **Do** use Archive para títulos, anos, placares e ratings, mantendo Segoe UI/Arial/system no corpo operacional.
- **Do** mantenha o draft em três colunas a partir de 921px e em abas até 920px.
- **Do** comunique estados com texto, forma e contraste além da cor.
- **Do** respeite foco visível e `prefers-reduced-motion` em toda interação.

### Don't:

- **Don't** transforme o produto em dashboard corporativo com cartões uniformes e métricas decorativas.
- **Don't** use verde fora do campo como preenchimento genérico de superfície.
- **Don't** espalhe dourado por grandes áreas; sua raridade comunica importância.
- **Don't** adicione sombras a painéis, tabelas ou controles planos.
- **Don't** substitua a densidade editorial por uma sequência longa de blocos de landing page.

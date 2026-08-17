# Direção — Arquivo de uma campanha impossível

## Mundo visual

Um programa de jogo de arquivo foi levado para dentro de uma sala de análise contemporânea. O fundo é carvão quase preto; linhas finas e números de temporada criam orientação. O dourado envelhecido aparece apenas em escolhas, avanço e título. O campo verde escuro é o único grande bloco cromático.

## Tipografia e composição

Geist é a voz operacional. Títulos usam peso 700–800 e largura controlada; placares, anos e overall usam numerais tabulares. Composição assimétrica no desktop e sequência vertical inequívoca no celular.

## Assinatura

Uma linha de campanha no topo registra as cinco fases e se acende conforme o jogador avança. O campo usa marcações autorais em CSS e fichas circulares legíveis em qualquer tela.

## Movimento

Transições entre 160 e 240 ms comunicam seleção, simulação e avanço. A partida tem um cursor de tempo e eventos revelados em poucos segundos. `prefers-reduced-motion` elimina deslocamentos e atrasos decorativos.

## Componentes

- Botões primários dourado fosco sobre carvão; secundários transparentes.
- Painéis usam borda única ou mudança de superfície, nunca sombra e borda juntas.
- Tags são pequenas e somente informativas.
- Cards de atletas são linhas densas com posição, nome, overall e aptidão.
- Estados ativos têm cor, texto e forma; nunca dependem só de cor.

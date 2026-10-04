# Preto no Branco

<!-- impeccable:product-schema 1 -->

## Plataforma

Jogo web em Next.js, otimizado para desktop e celular. A campanha solo não exige conta.

## Para quem é

Pessoas que gostam da história do Atlético Mineiro e do futebol brasileiro, querem montar um time cruzando diferentes épocas e disputar uma campanha rápida, legível e imprevisível.

## Proposta

Preto no Branco transforma arquivo histórico em jogo. A pessoa sorteia elencos do Galo, escolhe atletas, monta seu time, define formação e tática e atravessa um mata-mata de 16 equipes, das oitavas à final.

## Experiência principal

1. Escolher formação, perfil tático e visibilidade dos overalls.
2. Sortear anos históricos do Atlético e selecionar até dois atletas de cada elenco.
3. Organizar titulares e reservas na mesa tática antes de cada partida.
4. Jogar quatro fases contra adversários brasileiros históricos.
5. Tomar decisões durante a partida, acompanhar lances, estatísticas, prorrogação e pênaltis.
6. Rever o resultado, a chave, os jogos e os elencos dos rivais já enfrentados.
7. Compartilhar a campanha por um link curto que abre em outro dispositivo.

## Base atual

- 21 elencos históricos do Atlético.
- 49 adversários brasileiros históricos.
- 4 formações e 4 perfis táticos.
- Campanha com oitavas, quartas, semifinal e final.
- Persistência da campanha solo e do último resultado no navegador.
- Compartilhamento de snapshots por link curto usando Redis no servidor.
- Contador anônimo de pessoas jogando, sem coleta de dados pessoais.
- Multiplayer preservado no código, mas temporariamente indisponível até uma nova etapa de desenvolvimento e validação.

## Regras de produto

- O campo é uma interface funcional, não uma ilustração.
- Força maior gera vantagem, nunca certeza.
- Escolhas ruins continuam permitidas e têm consequência clara.
- Rivais futuros não revelam o elenco antes do confronto.
- O jogo deve preservar surpresa, gols, prorrogação e pênaltis.
- Nenhuma função solo pode depender do multiplayer.
- Links compartilhados não expõem payloads, credenciais ou dados pessoais.

## Persistência e serviços

- `localStorage`: campanha solo ativa, último resultado, histórico local e preferências de interface.
- Redis no servidor: snapshots compartilhados, links curtos e presença anônima.
- Supabase: estrutura do multiplayer, atualmente pausada e fora da navegação pública.

## Identidade

Jogo premium, compacto, escuro, branco e dourado. A marca principal é a prancheta do Preto no Branco. O verde fica concentrado no campo. A Master Digital aparece no rodapé como autoria clicável.

## Acessibilidade e privacidade

Controles por teclado, foco visível, contraste adequado, alvos de toque de pelo menos 44px, leitura sem depender apenas da cor e respeito a `prefers-reduced-motion`. O jogo não solicita nome real, email, telefone ou qualquer dado pessoal para a campanha solo.

## Princípios

- Priorizar a ação principal e a leitura do jogo.
- Manter texto funcional com pelo menos 11px.
- Evitar sobreposição, corte, scroll horizontal e informação duplicada.
- Compactar espaçamento antes de reduzir legibilidade.
- Manter a experiência completa em notebooks, janelas reduzidas e celulares.
- Preservar a campanha solo ao evoluir serviços online.

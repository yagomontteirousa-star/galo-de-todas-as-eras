import type { MatchMomentId, MatchMomentInstruction } from "@/types/game";

export type MatchMoment = {
  id: MatchMomentId;
  question: string;
  detail: string;
  choices: { id: MatchMomentInstruction; label: string; detail: string }[];
};

/**
 * A frase nunca nasce solta: o motor só libera cada contexto quando o placar e os
 * lances até 65' o sustentam. O texto é curto porque a decisão precisa ser lida no
 * ritmo da partida, não como uma segunda tela de análise.
 */
export const matchMoments: Record<MatchMomentId, MatchMoment> = {
  "trailing-control": {
    id: "trailing-control", question: "O rival tomou o controle. Como buscar o empate?", detail: "A bola tem ficado mais tempo no campo adversário.",
    choices: [{ id: "press", label: "Apertar a saída", detail: "Recupera alto, mas abre espaço" }, { id: "direct", label: "Ser direto", detail: "Pula linhas para chegar rápido" }, { id: "calm", label: "Recuperar a bola", detail: "Cadencia antes de atacar" }],
  },
  "trailing-break": {
    id: "trailing-break", question: "O placar aperta. Onde o time procura a reação?", detail: "Ainda há tempo para mudar o roteiro.",
    choices: [{ id: "wide", label: "Abrir pelos lados", detail: "Leva o jogo à linha de fundo" }, { id: "inside", label: "Atacar por dentro", detail: "Procura tabelas entre linhas" }, { id: "set_pieces", label: "Buscar a bola parada", detail: "Valoriza cada falta e escanteio" }],
  },
  "draw-open": {
    id: "draw-open", question: "O empate deixa tudo aberto. Qual é o próximo passo?", detail: "A partida está no limite entre paciência e risco.",
    choices: [{ id: "press", label: "Tomar o campo", detail: "Aumenta a pressão no rival" }, { id: "hold", label: "Controlar o duelo", detail: "Equilíbrio para não se expor" }, { id: "counter", label: "Esperar o erro", detail: "Protege e acelera na transição" }],
  },
  "draw-keeper": {
    id: "draw-keeper", question: "O goleiro rival fechou o gol. Como quebrar o empate?", detail: "As melhores chances pararam nas mãos dele.",
    choices: [{ id: "shots", label: "Chutar mais", detail: "Testa o rebote de fora" }, { id: "inside", label: "Trabalhar a área", detail: "Procura uma chance mais limpa" }, { id: "set_pieces", label: "Forçar escanteios", detail: "Leva o perigo para a bola parada" }],
  },
  "lead-pressure": {
    id: "lead-pressure", question: "A vantagem está de pé, mas o rival cresceu. Como responder?", detail: "A torcida sente a pressão da reta final.",
    choices: [{ id: "protect", label: "Fechar a casa", detail: "Protege a área e reduz o risco" }, { id: "counter", label: "Contra-atacar", detail: "Ataca os espaços que aparecem" }, { id: "hold", label: "Prender a bola", detail: "Esfria o impulso rival" }],
  },
  "lead-control": {
    id: "lead-control", question: "O time vence. Como administrar a reta final?", detail: "A vantagem pede lucidez, não recuo automático.",
    choices: [{ id: "hold", label: "Ter a bola", detail: "Controla o ritmo do jogo" }, { id: "counter", label: "Manter a ameaça", detail: "Não deixa o rival subir livre" }, { id: "protect", label: "Proteger o resultado", detail: "Fecha os setores decisivos" }],
  },
  "rival-tired-right": {
    id: "rival-tired-right", question: "O rival está cansado pelo lado direito. O que fazer?", detail: "A cobertura daquele corredor começou a atrasar.",
    choices: [{ id: "wide", label: "Atacar o corredor", detail: "Acelera pela faixa livre" }, { id: "inside", label: "Inverter por dentro", detail: "Usa o espaço para tabelar" }, { id: "hold", label: "Controlar a posse", detail: "Faz o rival correr atrás da bola" }],
  },
  "rival-tired-left": {
    id: "rival-tired-left", question: "O rival perde fôlego pelo lado esquerdo. Qual é a leitura?", detail: "O setor começa a ceder terreno.",
    choices: [{ id: "wide", label: "Explorar a faixa", detail: "Ataca com amplitude e velocidade" }, { id: "inside", label: "Puxar para dentro", detail: "Cria superioridade na entrada da área" }, { id: "set_pieces", label: "Forçar cruzamentos", detail: "Procura faltas e escanteios" }],
  },
  rain: {
    id: "rain", question: "A chuva engrossou e o gramado mudou. Como o time volta?", detail: "A bola passa a correr mais e o bote fica mais arriscado.",
    choices: [{ id: "direct", label: "Jogo direto", detail: "Evita conduções longas" }, { id: "wide", label: "Bola no chão", detail: "Busca o lado mais firme do campo" }, { id: "protect", label: "Sem riscos", detail: "Reduz perdas perto da área" }],
  },
  "heavy-pitch": {
    id: "heavy-pitch", question: "O campo pesou. Como ganhar a segunda bola?", detail: "O ritmo caiu e cada disputa ficou mais física.",
    choices: [{ id: "direct", label: "Esticar o jogo", detail: "Briga pela sobra no ataque" }, { id: "press", label: "Chegar junto", detail: "Aumenta a disputa no meio" }, { id: "calm", label: "Circular curto", detail: "Evita passes forçados" }],
  },
  floodlights: {
    id: "floodlights", question: "Os refletores oscilaram. Como voltar quando o jogo reiniciar?", detail: "A pausa quebrou o ritmo das duas equipes.",
    choices: [{ id: "restart_fast", label: "Voltar ligado", detail: "Tenta surpreender na retomada" }, { id: "restart_safe", label: "Reorganizar primeiro", detail: "Retoma com segurança" }, { id: "press", label: "Abafar a saída", detail: "Transforma a pausa em pressão" }],
  },
  wind: {
    id: "wind", question: "O vento mudou a trajetória da bola. Que ajuste faz sentido?", detail: "Lançamentos longos perderam precisão.",
    choices: [{ id: "calm", label: "Passar curto", detail: "Mantém a bola rasteira" }, { id: "shots", label: "Chutar de média distância", detail: "Testa o desvio do vento" }, { id: "set_pieces", label: "Valorizar faltas", detail: "Usa a bola parada com atenção" }],
  },
};

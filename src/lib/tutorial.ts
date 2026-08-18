import type { GameScreen } from "@/types/game";

export const TUTORIAL_STORAGE_KEY = "preto-no-branco:tutorial:v1";

export interface TutorialState { dismissed: boolean; seen: string[] }

export interface TutorialTip {
  id: string;
  screen: GameScreen;
  step: number;
  title: string;
  body: string;
  /** Elemento destacado enquanto a dica está visível. */
  target?: string;
}

export const tutorialTips: TutorialTip[] = [
  { id: "mode", screen: "setup", step: 1, title: "Escolha o seu jogo", body: "Formação, plano tático e quanto o jogo revela de cada atleta.", target: ".setup-controls" },
  { id: "roster", screen: "draft", step: 2, title: "Dois nomes por ano", body: "Cada ano sorteado abre um elenco. Toque no atleta que você quer levar.", target: ".roster-scroll" },
  { id: "slots", screen: "draft", step: 3, title: "Agora a posição", body: "Toque na vaga do campo. Depois, tocar na peça troca a posição do atleta.", target: ".field-column" },
  { id: "team", screen: "analysis", step: 4, title: "Leia o seu time", body: "Overall, setores e improvisos explicam onde a sua equipe ganha e onde sofre.", target: ".analysis-report" },
  { id: "campaign", screen: "bracket", step: 5, title: "A campanha começa", body: "Oitavas até a final. Quatro jogos, sem volta.", target: ".bracket-heading" },
];

export const TUTORIAL_STEPS = tutorialTips.length;
const emptyState: TutorialState = { dismissed: false, seen: [] };

export function readTutorial(): TutorialState {
  try {
    const value = JSON.parse(window.localStorage.getItem(TUTORIAL_STORAGE_KEY) ?? "null") as TutorialState | null;
    if (!value || typeof value.dismissed !== "boolean" || !Array.isArray(value.seen)) return emptyState;
    return { dismissed: value.dismissed, seen: value.seen.filter((id) => tutorialTips.some((tip) => tip.id === id)) };
  } catch { return emptyState; }
}

export function saveTutorial(state: TutorialState): void {
  try { window.localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(state)); }
  catch { /* sem armazenamento o tutorial reaparece na próxima sessão; não é bloqueante */ }
}

export function nextTip(state: TutorialState, screen: GameScreen): TutorialTip | undefined {
  if (state.dismissed) return undefined;
  return tutorialTips.find((tip) => tip.screen === screen && !state.seen.includes(tip.id));
}

/** O usuário já teve contato com o tutorial: vale oferecer a revisão discreta. */
export const tutorialTouched = (state: TutorialState) => state.dismissed || state.seen.length > 0;
export const restartTutorial = (): TutorialState => ({ dismissed: false, seen: [] });

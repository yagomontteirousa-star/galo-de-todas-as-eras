import { useEffect } from "react";
import type { TutorialTip } from "@/lib/tutorial";
import { TUTORIAL_STEPS } from "@/lib/tutorial";

/** Destaca o alvo da dica sem alterar o layout: só uma borda suave enquanto ela existe. */
function useHighlight(selector?: string) {
  useEffect(() => {
    if (!selector) return;
    const node = document.querySelector(selector);
    node?.classList.add("is-tutorial-target");
    return () => node?.classList.remove("is-tutorial-target");
  }, [selector]);
}

export function TutorialCoach({ tip, onNext, onDismiss }: { tip: TutorialTip; onNext: () => void; onDismiss: () => void }) {
  useHighlight(tip.target);
  const last = tip.step === TUTORIAL_STEPS;
  return (
    <aside className="tutorial-coach" role="note" aria-label="Tutorial da primeira campanha">
      <span className="tutorial-coach__step">Passo {tip.step} de {TUTORIAL_STEPS}</span>
      <b>{tip.title}</b>
      <p>{tip.body}</p>
      <div className="tutorial-coach__actions">
        <button type="button" className="tutorial-coach__skip" onClick={onDismiss}>Pular tutorial</button>
        <button type="button" className="tutorial-coach__next" onClick={onNext}>{last ? "Concluir" : "Entendi"}</button>
      </div>
    </aside>
  );
}

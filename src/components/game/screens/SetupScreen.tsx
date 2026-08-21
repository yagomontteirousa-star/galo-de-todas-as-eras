import { Pitch } from "@/components/game/Pitch";
import { formations, tacticLabels } from "@/data/formations";
import type { FormationId, RatingsMode, TacticId } from "@/types/game";
import { useState } from "react";
import { ArrowIcon, CheckIcon } from "@/components/ui/Icons";

const ratingsOptions: { id: RatingsMode; label: string; detail: string }[] = [
  { id: "memory", label: "Tenho cabedal", detail: "Jogar sem overall, confiando no conhecimento histórico." },
  { id: "visible", label: "Quero uma ajuda", detail: "Jogar com overall visível como apoio." },
];

export function SetupScreen({ onContinue, fixedRatingsMode }: { onContinue: (formation: FormationId, tactic: TacticId, ratingsMode: RatingsMode) => void; fixedRatingsMode?: RatingsMode }) {
  const [formation, setFormation] = useState<FormationId>("4-3-3");
  const [tactic, setTactic] = useState<TacticId>("balanced");
  const [ratingsMode, setRatingsMode] = useState<RatingsMode>(fixedRatingsMode ?? "visible");
  const effectiveRatingsMode = fixedRatingsMode ?? ratingsMode;
  return (
    <main className="screen screen--setup" id="main">
      <div className="setup-layout">
        <div className="setup-pitch">
          <Pitch formationId={formation} tactic={tactic}/>
        </div>
        <div className="setup-controls">
          <div className="setup-title"><h1>Defina o seu jogo.</h1></div>

          <fieldset>
            <legend>Formação</legend>
            <div className="choice-grid choice-grid--formation">
              {(Object.keys(formations) as FormationId[]).map((id) => (
                <button type="button" key={id} className={`choice-card ${formation === id ? "is-selected" : ""}`} onClick={() => setFormation(id)} aria-pressed={formation === id}>
                  <span>{id}</span>{formation === id && <CheckIcon/>}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="setup-tactics">
            <legend>Perfil tático</legend>
            <div className="choice-grid">
              {(Object.keys(tacticLabels) as TacticId[]).map((id) => (
                <button type="button" key={id} className={`tactic-choice ${tactic === id ? "is-selected" : ""}`} onClick={() => setTactic(id)} aria-pressed={tactic === id}>
                  <b>{tacticLabels[id].name}</b><span>{tacticLabels[id].description}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {!fixedRatingsMode && <fieldset>
            <legend>Overall na hora de escolher</legend>
            <div className="ratings-choice">
              {ratingsOptions.map((option) => (
                <button type="button" key={option.id} className={ratingsMode === option.id ? "is-selected" : ""} onClick={() => setRatingsMode(option.id)} aria-pressed={ratingsMode === option.id}>
                  <b>{option.label}</b><span>{option.detail}</span>
                </button>
              ))}
            </div>
          </fieldset>}

          <button className="button button--primary button--wide" type="button" onClick={() => onContinue(formation, tactic, effectiveRatingsMode)}>Sortear o primeiro ano<ArrowIcon/></button>
        </div>
      </div>
    </main>
  );
}

import { Pitch } from "@/components/game/Pitch";
import { formations, tacticLabels } from "@/data/formations";
import type { FormationId, RatingsMode, TacticId } from "@/types/game";
import { useState } from "react";
import { ArrowIcon, CheckIcon } from "@/components/ui/Icons";

export function SetupScreen({ onContinue }: { onContinue: (formation: FormationId, tactic: TacticId, ratingsMode: RatingsMode) => void }) {
  const [formation, setFormation] = useState<FormationId>("4-3-3");
  const [tactic, setTactic] = useState<TacticId>("balanced");
  const [ratingsMode, setRatingsMode] = useState<RatingsMode>("visible");
  return (
    <main className="screen screen--setup" id="main">
      <div className="screen-heading"><h1>Defina o seu jogo.</h1><p>Formação, plano tático e quanto você quer saber antes de cada escolha.</p></div>
      <div className="setup-layout">
        <div className="setup-pitch"><Pitch formationId={formation}/><div className="formation-caption"><b>{formations[formation].name}</b><span>{formations[formation].description}</span></div></div>
        <div className="setup-controls">
          <fieldset><legend>Formação</legend><div className="choice-grid choice-grid--formation">
            {(Object.keys(formations) as FormationId[]).map((id) => <button type="button" key={id} className={`choice-card ${formation === id ? "is-selected" : ""}`} onClick={() => setFormation(id)} aria-pressed={formation === id}><span>{id}</span>{formation === id && <CheckIcon/>}</button>)}
          </div></fieldset>
          <fieldset><legend>Perfil tático</legend><div className="choice-grid">
            {(Object.keys(tacticLabels) as TacticId[]).map((id) => <button type="button" key={id} className={`tactic-choice ${tactic === id ? "is-selected" : ""}`} onClick={() => setTactic(id)} aria-pressed={tactic === id}><b>{tacticLabels[id].name}</b><span>{tacticLabels[id].description}</span><small>Risco: {tacticLabels[id].risk}</small></button>)}
          </div></fieldset>
          <fieldset><legend>Informação durante o draft</legend><div className="ratings-choice">
            <button type="button" className={ratingsMode === "visible" ? "is-selected" : ""} onClick={() => setRatingsMode("visible")} aria-pressed={ratingsMode === "visible"}><b>Ratings visíveis</b><span>Overall, atributos e força do adversário ficam abertos.</span></button>
            <button type="button" className={ratingsMode === "memory" ? "is-selected" : ""} onClick={() => setRatingsMode("memory")} aria-pressed={ratingsMode === "memory"}><b>Modo memória</b><span>Escolha por nome, posição, era e lembrança.</span></button>
          </div></fieldset>
          <button className="button button--primary button--wide" type="button" onClick={() => onContinue(formation, tactic, ratingsMode)}>Sortear primeira era<ArrowIcon/></button>
        </div>
      </div>
    </main>
  );
}

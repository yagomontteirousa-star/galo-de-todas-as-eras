import { useEffect, useRef, useState } from "react";
import { Pitch } from "@/components/game/Pitch";
import { tacticLabels } from "@/data/formations";
import { squadsById } from "@/data/atletico-squads";
import { opponents } from "@/data/opponents";
import type { Campaign, TeamSnapshot } from "@/types/game";
import { ArrowIcon, CheckIcon } from "@/components/ui/Icons";

export function AnalysisScreen({ campaign, team, onStart, autoStartSeconds }: { campaign: Campaign; team: TeamSnapshot; onStart: () => void; autoStartSeconds?: number }) {
  const o = team.overall;
  const showRatings = campaign.ratingsMode !== "memory";
  const [secondsLeft, setSecondsLeft] = useState(autoStartSeconds);
  const completed = useRef(false);
  const startRef = useRef(onStart);
  useEffect(() => { startRef.current = onStart; }, [onStart]);
  const start = () => {
    if (completed.current) return;
    completed.current = true;
    onStart();
  };
  useEffect(() => {
    if (!autoStartSeconds) return;
    const deadline = Date.now() + autoStartSeconds * 1000;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0 && !completed.current) {
        completed.current = true;
        window.clearInterval(timer);
        startRef.current();
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [autoStartSeconds]);
  return (
    <main className="screen analysis-screen" id="main">
      <div className="analysis-hero"><div><span>ESCALAÇÃO CONFIRMADA</span><h1>Agora é<br/>preto no branco.</h1><p>{campaign.formation} · {tacticLabels[campaign.tactic!].name}</p></div>{showRatings && <div className="overall-seal"><span>OVERALL</span><strong>{o.final}</strong><small>{o.final >= 90 ? "Lendário" : o.final >= 86 ? "Candidato ao título" : "Pronto para competir"}</small></div>}</div>
      <div className="analysis-layout">
        <section className="analysis-pitch"><Pitch formationId={campaign.formation!} tactic={campaign.tactic} lineup={campaign.lineup}/></section>
        <aside className="analysis-report">
          {showRatings && <div className="sector-scores"><div><span>Defesa</span><b>{o.defense}</b></div><div><span>Meio</span><b>{o.midfield}</b></div><div><span>Ataque</span><b>{o.attack}</b></div></div>}
          {showRatings && <div className="overall-breakdown"><h2>Leitura do overall</h2><dl><div><dt>Base ponderada</dt><dd>{o.base}</dd></div><div><dt>Coesão tática</dt><dd className={o.cohesion >= 0 ? "is-positive" : "is-negative"}>{o.cohesion >= 0 ? "+" : ""}{o.cohesion}</dd></div><div><dt>Encaixe do perfil</dt><dd className={o.tacticBonus >= 0 ? "is-positive" : "is-negative"}>{o.tacticBonus >= 0 ? "+" : ""}{o.tacticBonus}</dd></div><div><dt>Improvisações</dt><dd className="is-negative">−{o.improvisationPenalty}</dd></div><div><dt>Desequilíbrio</dt><dd className="is-negative">−{o.balancePenalty}</dd></div></dl></div>}
          <div className="tactical-reading"><div><h2>Pontos fortes</h2>{o.strengths.map((item) => <p key={item}><CheckIcon/>{item}</p>)}</div><div><h2>Pontos frágeis</h2>{o.weaknesses.map((item) => <p key={item}><span>!</span>{item}</p>)}</div></div>
        </aside>
      </div>
      <section className="era-summary"><h2>As eras do seu time</h2><div>{campaign.lineup.map((entry) => {
        const evaluation = o.evaluations.find((item) => item.player.id === entry.playerId)!;
        const squad = squadsById.get(entry.squadId)!;
        return <article key={entry.slotId} className={showRatings ? undefined : "is-ratings-hidden"}><span>{squad.year}</span><div><b>{evaluation.player.name}</b><small>{squad.name} · {evaluation.slot.label}</small></div>{showRatings && <strong>{evaluation.adjustedOverall}</strong>}</article>;
      })}</div></section>
      <div className="analysis-cta"><p>Oitavas de final: 15 adversários sorteados entre {opponents.length} elencos históricos. Quatro jogos até o título.</p>{secondsLeft !== undefined && <span className="auto-advance-timer" role="timer" aria-label={`Chaveamento em ${secondsLeft} segundos`}><b>{secondsLeft}</b><small>chaveamento</small></span>}<button type="button" className="button button--primary" onClick={start}>{autoStartSeconds ? "Iniciar agora" : "Iniciar mata-mata"}<ArrowIcon/></button></div>
    </main>
  );
}

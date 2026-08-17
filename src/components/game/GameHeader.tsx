import { roundLabels, roundOrder } from "@/lib/bracket";
import type { Campaign } from "@/types/game";
import { squadsById } from "@/data/atletico-squads";

export function GameHeader({ campaign, onHome, onRestart }: { campaign: Campaign; onHome: () => void; onRestart: () => void }) {
  const isCampaign = campaign.screen !== "home" && campaign.screen !== "setup";
  const currentIndex = campaign.bracket ? roundOrder.indexOf(campaign.bracket.currentRound) : -1;
  const squad = campaign.currentSquadId ? squadsById.get(campaign.currentSquadId) : undefined;
  const remaining = Math.max(0, 11 - campaign.lineup.length);
  return (
    <header className="game-header">
      <button type="button" className="game-brand" onClick={onHome} aria-label="Ir para o início">
        <span className="game-brand__monogram" aria-hidden="true">PB</span><span>Preto <b>no Branco</b></span>
      </button>
      {isCampaign && (
        <div className="campaign-strip" aria-label="Estado da campanha">
          <span><small>ERA</small><b>{squad ? squad.year : campaign.bracket ? "MATA-MATA" : "XI FECHADO"}</b></span>
          <span><small>ESCALAÇÃO</small><b>{11 - remaining}/11</b></span>
          <span><small>FORMAÇÃO</small><b>{campaign.formation}</b></span>
          <span><small>REROLLS</small><b>{campaign.rerollsLeft}</b></span>
          <span className="campaign-strip__mode"><small>RATINGS</small><b>{campaign.ratingsMode === "memory" ? "MEMÓRIA" : "VISÍVEIS"}</b></span>
        </div>
      )}
      {campaign.bracket && (
        <nav className="round-track" aria-label="Progresso no torneio">
          {roundOrder.map((round, index) => <span key={round} className={index < currentIndex ? "is-done" : index === currentIndex ? "is-current" : ""}>{roundLabels[round]}</span>)}
        </nav>
      )}
      {isCampaign && <button type="button" className="text-action" onClick={onRestart}>Nova campanha</button>}
    </header>
  );
}

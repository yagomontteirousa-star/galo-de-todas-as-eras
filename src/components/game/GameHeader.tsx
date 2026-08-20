import { roundLabels, roundOrder } from "@/lib/bracket";
import type { Campaign } from "@/types/game";
import { squadsById } from "@/data/atletico-squads";
import { BrandMark } from "@/components/ui/Brand";

export function GameHeader({ campaign, overall, onHome, onRestart }: { campaign: Campaign; overall?: number; onHome: () => void; onRestart: () => void }) {
  const isCampaign = campaign.screen !== "home" && campaign.screen !== "setup";
  const currentIndex = campaign.bracket ? roundOrder.indexOf(campaign.bracket.currentRound) : -1;
  const squad = campaign.currentSquadId ? squadsById.get(campaign.currentSquadId) : undefined;
  const remaining = Math.max(0, 11 - campaign.lineup.length);
  return (
    <header className="game-header">
      <button type="button" className="game-brand" onClick={onHome} aria-label="Preto no Branco, ir para o início">
        <BrandMark size={34} className="game-brand__mark"/><span>Preto <b>no Branco</b></span>
      </button>
      {isCampaign && (
        <div className="campaign-strip" aria-label="Estado da campanha">
          {/* Prioridade no celular: fase, escalação e overall. O resto é secundário. */}
          <span><small>FASE</small><b>{campaign.bracket ? roundLabels[campaign.bracket.currentRound] : squad ? squad.year : "XI FECHADO"}</b></span>
          <span><small>ESCALAÇÃO</small><b>{11 - remaining}/11</b></span>
          <span><small>OVERALL</small><b>{overall ?? (campaign.ratingsMode === "memory" ? "OCULTO" : "·")}</b></span>
          <span className="campaign-strip__extra"><small>FORMAÇÃO</small><b>{campaign.formation}</b></span>
          <span className="campaign-strip__extra"><small>SORTEIOS</small><b>{campaign.rerollsLeft}</b></span>
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

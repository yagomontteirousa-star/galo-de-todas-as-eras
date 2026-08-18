import { getCurrentUserMatch, rivalOf, roundLabels, scoreOf, teamEra, userMatches } from "@/lib/bracket";
import { formations, tacticLabels } from "@/data/formations";
import type { BracketMatch, Campaign, PlayerEvaluation, TeamSnapshot } from "@/types/game";
import type { CSSProperties } from "react";
import { useState } from "react";
import { ArrowIcon } from "@/components/ui/Icons";
import { BrandMark, SiteFooter } from "@/components/ui/Brand";

const SHARE_URL = "https://pretonobranco.app";
/** Tags que todo atleta ganha por padrão; o que sobra é o que faz o nome ser especial. */
const GENERIC_TAGS = new Set(["regular", "titular", "reflexos", "finalizador"]);
const isSpecial = (entry: PlayerEvaluation) => entry.player.tags.some((tag) => !GENERIC_TAGS.has(tag));

export function OutcomeScreen({ campaign, outcome, onContinue, onRestart }: {
  campaign: Campaign;
  outcome: "victory" | "eliminated" | "champion";
  onContinue: () => void;
  onRestart: () => void;
}) {
  const next = campaign.bracket ? getCurrentUserMatch(campaign.bracket) : undefined;
  const played = userMatches(campaign.bracket);
  const lastMatch = played.find((match) => match.id === campaign.lastMatchId) ?? played[played.length - 1];
  const result = lastMatch?.result;
  const homeTotal = result ? result.homeScore + result.homeExtra : 0;
  const awayTotal = result ? result.awayScore + result.awayExtra : 0;
  const userTeam: TeamSnapshot | undefined = lastMatch?.home.isUser ? lastMatch.home : lastMatch?.away;
  const opponent = lastMatch?.home.isUser ? lastMatch.away : lastMatch?.home;
  const goals = result?.events.filter((event) => event.type === "goal") ?? [];
  const goalLine = (teamId?: string) => teamId === lastMatch?.home.id ? lastMatch?.home.name : lastMatch?.away.name;

  if (outcome !== "victory") {
    return <CampaignReport campaign={campaign} outcome={outcome} played={played} userTeam={userTeam} onContinue={onContinue} onRestart={onRestart}/>;
  }

  return (
    <main className="outcome-screen outcome-screen--victory" id="main">
      <section className="outcome-summary">
        <div className="outcome-monogram"><BrandMark size={44}/></div>
        <span>{campaign.wins}ª vitória</span>
        <h1>Classificado.</h1>
        <p>{next ? `A próxima página é ${roundLabels[campaign.bracket!.currentRound]} contra ${rivalOf(next).name}.` : "A próxima fase já está definida."}</p>
        <div className="outcome-actions">
          <button type="button" className="button button--primary" onClick={onContinue}>Próxima fase<ArrowIcon/></button>
          <button type="button" className="button button--quiet" onClick={onRestart}>Nova campanha</button>
        </div>
      </section>
      <aside className="result-sheet">
        <header><span>{lastMatch ? roundLabels[lastMatch.round] : "Resultado"}</span><b>{lastMatch && `${teamEra(lastMatch.home)} · ${teamEra(lastMatch.away)}`}</b></header>
        <div className="result-score"><div><small>{lastMatch?.home.name}</small><strong>{homeTotal}</strong></div><i>×</i><div><small>{lastMatch?.away.name}</small><strong>{awayTotal}</strong></div></div>
        {result?.wentToPenalties && <p className="penalty-result">Pênaltis · {result.homePenalties} a {result.awayPenalties}</p>}
        <div className="result-facts">
          <div><span>Overall</span><b>{userTeam?.overall.final ?? "·"} × {opponent?.overall.final ?? "·"}</b></div>
          <div><span>Melhor em campo</span><b>{result?.playerOfMatch ?? "·"}</b></div>
          <div><span>Impacto tático</span><b>{result?.instructionImpact ?? "Plano mantido do começo ao fim."}</b></div>
        </div>
        <div className="result-goals"><span>Gols</span>{goals.length ? goals.map((goal) => <p key={goal.id}><time>{goal.minute}′</time><b>{goal.playerName}</b><small>{goalLine(goal.teamId)}</small></p>) : <p>Sem gols no tempo de jogo.</p>}</div>
      </aside>
      <SiteFooter/>
    </main>
  );
}

/**
 * Cópia de texto que ainda funciona onde a Clipboard API não existe (http, WebView antiga).
 * Sem isso o botão de compartilhar só teria caminho feliz.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* segue para o modo antigo */ }
  try {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0";
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(field);
    return copied;
  } catch { return false; }
}

function CampaignReport({ campaign, outcome, played, userTeam, onContinue, onRestart }: {
  campaign: Campaign;
  outcome: "eliminated" | "champion";
  played: BracketMatch[];
  userTeam?: TeamSnapshot;
  onContinue: () => void;
  onRestart: () => void;
}) {
  const [shareState, setShareState] = useState<"idle" | "copied" | "failed">("idle");
  const champion = outcome === "champion";
  const phase = champion ? "Campeão" : roundLabels[campaign.bracket?.currentRound ?? "round16"];
  const tactic = campaign.tactic ? tacticLabels[campaign.tactic].name : "·";
  const years = played.map((match) => rivalOf(match).year);
  const lastMatch = played.at(-1);
  const finalScore = lastMatch && scoreOf(lastMatch);

  const evaluations = userTeam?.overall.evaluations ?? [];
  const best = [...evaluations].sort((left, right) => right.adjustedOverall - left.adjustedOverall).slice(0, 4);
  const topRating = best[0]?.adjustedOverall ?? 99;
  const highlighted = new Set(best.map((entry) => entry.slot.id));
  // O elenco inteiro entra na arte, na ordem da formação, para a escalação ser lida de cima a baixo.
  const order = userTeam ? formations[userTeam.formation].slots : [];
  const squad = [...evaluations].sort(
    (left, right) => order.findIndex((slot) => slot.id === left.slot.id) - order.findIndex((slot) => slot.id === right.slot.id),
  );

  const shareText = [
    champion ? "Campeão com o Galo no Preto no Branco." : `Caí nas ${phase.toLowerCase()} no Preto no Branco.`,
    finalScore ? `${finalScore.user} a ${finalScore.rival}${finalScore.pens} contra ${rivalOf(lastMatch!).name}.` : "",
    `${campaign.wins} ${campaign.wins === 1 ? "vitória" : "vitórias"} · overall ${userTeam?.overall.final ?? "?"} · ${campaign.formation ?? ""} ${tactic.toLowerCase()}`,
    years.length ? `Peguei ${years.join(", ")}.` : "",
    SHARE_URL,
  ].filter(Boolean).join("\n");

  const share = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Preto no Branco", text: shareText, url: SHARE_URL });
        return;
      } catch (error) {
        // Desistir da folha de compartilhamento não é falha: nada a avisar.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    setShareState(await copyText(shareText) ? "copied" : "failed");
  };

  return (
    <main className={`outcome-screen campaign-report campaign-report--${outcome}`} id="main">
      <div className={champion ? "champion-scene" : "farewell-scene"} aria-hidden="true"/>
      <section className="report-card">
        <header className="report-head">
          <BrandMark size={44}/>
          <div>
            <span className="report-eyebrow">{champion ? "Campeão" : "Fim de campanha"}</span>
            <h1>{champion ? "A taça é do Galo." : "O arquivo fecha aqui."}</h1>
          </div>
          {finalScore && (
            <div className="report-final">
              <small>{lastMatch ? roundLabels[lastMatch.round] : ""}</small>
              <b>{finalScore.user}<i>×</i>{finalScore.rival}</b>
              <span>{rivalOf(lastMatch!).name}{finalScore.pens}</span>
            </div>
          )}
        </header>

        <dl className="report-facts">
          <div><dt>Fase</dt><dd>{phase}</dd></div>
          <div><dt>Vitórias</dt><dd>{campaign.wins}</dd></div>
          <div><dt>Overall</dt><dd>{userTeam?.overall.final ?? "·"}</dd></div>
          <div><dt>Formação</dt><dd>{campaign.formation ?? "·"}</dd></div>
          <div><dt>Perfil</dt><dd>{tactic}</dd></div>
        </dl>

        <div className="report-grid">
          <section className="report-block">
            <h2>Destaques da campanha</h2>
            <ul className="report-stars">
              {best.map((entry) => (
                <li key={entry.slot.id} style={{ "--force": `${Math.round((entry.adjustedOverall / topRating) * 100)}%` } as CSSProperties}>
                  <b>{entry.player.name}{isSpecial(entry) && <i className="report-flag" title={entry.player.tags.join(", ")}>★</i>}</b>
                  <em>{entry.slot.label} · {entry.player.season}</em>
                  <strong>{entry.adjustedOverall}</strong>
                  <span className="report-bar" aria-hidden="true"/>
                </li>
              ))}
              {!best.length && <li><b>Elenco não registrado.</b></li>}
            </ul>
          </section>

          <section className="report-block">
            <h2>O onze completo</h2>
            <ul className="report-squad">
              {squad.map((entry) => (
                <li key={entry.slot.id} className={`${highlighted.has(entry.slot.id) ? "is-top" : ""} ${isSpecial(entry) ? "is-special" : ""}`}>
                  <em>{entry.slot.label}</em>
                  <b>{entry.player.name}</b>
                  <small>{entry.player.season}</small>
                  <strong>{entry.adjustedOverall}</strong>
                </li>
              ))}
              {!squad.length && <li><b>Escalação não registrada.</b></li>}
            </ul>
          </section>

          <section className="report-block">
            <h2>A campanha</h2>
            <ul className="report-runs">
              {played.map((match) => {
                const { user, rival, pens, won } = scoreOf(match);
                return (
                  <li key={match.id} className={won ? "is-win" : "is-loss"}>
                    <em>{roundLabels[match.round]}</em>
                    <b>{user} a {rival}</b>
                    <span>{rivalOf(match).name} {rivalOf(match).year}{pens}</span>
                  </li>
                );
              })}
              {!played.length && <li><span>Nenhum jogo disputado.</span></li>}
            </ul>
            {years.length > 0 && <p className="report-years">Anos enfrentados: {years.join(", ")}.</p>}
          </section>
        </div>

        <div className="outcome-actions">
          <button type="button" className="button button--primary" onClick={share}>
            {shareState === "copied" ? "Resultado copiado" : shareState === "failed" ? "Não deu para copiar" : "Compartilhar resultado"}
          </button>
          <button type="button" className="button button--quiet" onClick={onContinue}>Ver a chave</button>
          <button type="button" className="button button--quiet" onClick={onRestart}>Nova campanha</button>
        </div>
        {shareState === "failed" && <p className="share-fallback" role="status">Copie manualmente: <code>{SHARE_URL}</code></p>}
        <SiteFooter/>
      </section>
    </main>
  );
}

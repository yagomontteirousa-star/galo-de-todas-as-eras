import { Pitch } from "@/components/game/Pitch";
import { ArrowIcon } from "@/components/ui/Icons";
import { roundLabels } from "@/lib/bracket";
import { SiteFooter } from "@/components/ui/Brand";
import type { CampaignOutcome, CampaignRecord } from "@/types/game";

const shortDate = (value: string) => new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

export function HomeScreen({ onStart, onResume, canResume, onReviewLast, lastOutcome, history, onReplayTutorial }: {
  onStart: () => void;
  onResume: () => void;
  canResume: boolean;
  onReviewLast: () => void;
  lastOutcome?: CampaignOutcome;
  history: CampaignRecord[];
  onReplayTutorial?: () => void;
}) {
  return (
    <main className="home-screen" id="main">
      <section className="hero-game">
        <div className="hero-game__copy">
          <h1>Preto<br/>no Branco.</h1>
          <p className="hero-game__signature">Monte elencos. Atravesse eras. Faça história.</p>
          <p>Receba temporadas históricas, escolha os nomes certos e atravesse quatro fases contra grandes times brasileiros.</p>
          <div className="hero-game__actions">
            {canResume
              ? <button className="button button--primary" type="button" onClick={onResume}>Continuar campanha<ArrowIcon/></button>
              : <button className="button button--primary" type="button" onClick={onStart}>Começar campanha<ArrowIcon/></button>}
            {lastOutcome && <button className="button button--quiet" type="button" onClick={onReviewLast}>Última campanha</button>}
            <button className="button button--quiet" type="button" onClick={() => document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" })}>Como funciona</button>
          </div>
          <div className="hero-game__links">
            {canResume && <button type="button" className="new-run-link" onClick={onStart}>Ou começar uma nova campanha</button>}
            {onReplayTutorial && <button type="button" className="new-run-link" onClick={onReplayTutorial}>Ver tutorial</button>}
          </div>
          {history.length > 0 && (
            <ul className="campaign-history" aria-label="Campanhas anteriores">
              {history.slice(0, 3).map((record) => (
                <li key={record.id}>
                  <b className={record.outcome === "champion" ? "is-champion" : ""}>{record.outcome === "champion" ? "Campeão" : "Eliminado"}</b>
                  <span>{roundLabels[record.roundReached]}</span>
                  <span>{record.wins} {record.wins === 1 ? "vitória" : "vitórias"}</span>
                  <time dateTime={record.finishedAt}>{shortDate(record.finishedAt)}</time>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="hero-game__visual" aria-hidden="true">
          <div className="era-stamp era-stamp--one">1971</div><div className="era-stamp era-stamp--two">2013</div><div className="era-stamp era-stamp--three">2021</div>
          <div className="hero-pitch"><Pitch formationId="4-3-3" compact/></div>
          <div className="hero-score"><span>FINAL</span><strong>?</strong><i>×</i><strong>?</strong></div>
          <div className="hero-bracket">{Array.from({ length: 10 }, (_, i) => <span key={i}/>)}</div>
        </div>
      </section>
      <section className="how-it-works" id="como-funciona">
        <ol>
          <li><b>01</b><strong>Sorteie um ano</strong><span>Um elenco completo entra em jogo.</span></li>
          <li><b>02</b><strong>Escale os jogadores</strong><span>Encaixe talento, posição e tática.</span></li>
          <li><b>03</b><strong>Simule a campanha</strong><span>Das oitavas à final: quatro jogos até o título.</span></li>
        </ol>
      </section>
      <SiteFooter/>
    </main>
  );
}

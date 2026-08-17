import { Pitch } from "@/components/game/Pitch";
import { ArrowIcon, StarMark } from "@/components/ui/Icons";

export function HomeScreen({ onStart, onResume, canResume }: { onStart: () => void; onResume: () => void; canResume: boolean }) {
  return (
    <main className="home-screen" id="main">
      <section className="hero-game">
        <div className="hero-game__copy">
          <h1>Monte o maior Galo de todos os tempos.</h1>
          <p>Receba elencos históricos, recrute os melhores de cada era e atravesse cinco fases contra grandes times brasileiros até a final.</p>
          <div className="hero-game__actions">
            <button className="button button--primary" type="button" onClick={canResume ? onResume : onStart}>{canResume ? "Continuar campanha" : "Começar campanha"}<ArrowIcon/></button>
            <button className="button button--quiet" type="button" onClick={() => document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" })}>Como funciona</button>
          </div>
          {canResume && <button type="button" className="new-run-link" onClick={onStart}>Ou começar uma nova campanha</button>}
        </div>
        <div className="hero-game__visual" aria-hidden="true">
          <div className="era-stamp era-stamp--one">1971</div><div className="era-stamp era-stamp--two">2013</div><div className="era-stamp era-stamp--three">2021</div>
          <div className="hero-pitch"><Pitch formationId="4-3-3" compact/></div>
          <div className="hero-score"><span>FINAL</span><strong>?</strong><i>×</i><strong>?</strong></div>
          <div className="hero-bracket">{Array.from({ length: 10 }, (_, i) => <span key={i}/>)}</div>
        </div>
      </section>
      <section className="how-it-works" id="como-funciona">
        <div><StarMark/><h2>Onze vagas. Gerações sem limite.</h2></div>
        <ol>
          <li><strong>Escolha a ideia.</strong><span>Formação e perfil tático mudam encaixes, bônus e riscos.</span></li>
          <li><strong>Garimpe cada era.</strong><span>Selecione um ou dois nomes por elenco e posicione-os no campo.</span></li>
          <li><strong>Sobreviva ao mata-mata.</strong><span>Cinco confrontos, com prorrogação e pênaltis quando necessário.</span></li>
        </ol>
      </section>
    </main>
  );
}

/* eslint-disable @next/next/no-img-element -- next/og serializa a arte a partir de uma tag img. */
import { tacticLabels } from "@/data/formations";
import { roundLabels } from "@/lib/bracket";
import { eliminator, type SharedCampaign } from "@/lib/share";

const PAPER = "#f1efe7";
const MUTED = "#a9ada7";
const GOLD = "#d7c38e";
const STAR = "#f5c542";
const LINE = "#343936";

const label = { color: MUTED, fontSize: 24, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" as const };

/** Composição fixa para exportação. Não depende de viewport, scroll ou DOM escondido. */
export function campaignExportElement(data: SharedCampaign, championImage: string) {
  const champion = data.outcome === "champion";
  const phase = champion ? "Campeão" : data.runnerUp ? "Vice-campeão"
    : data.round === "semifinal" ? "Semifinalista" : roundLabels[data.round];
  const last = eliminator(data) ?? data.matches.at(-1);
  const best = [...data.squad].sort((a, b) => b.overall - a.overall).slice(0, 4);
  const title = champion ? "A taça é do Galo." : data.runnerUp ? "Faltou o último passo." : "O arquivo fecha aqui.";

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", display: "flex", flexDirection: "column", overflow: "hidden", background: "#0a0b0b", color: PAPER, fontFamily: "Arial", padding: "66px 68px 54px" }}>
      {champion && (
        <img src={championImage} width="1080" height="1350" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "66% center" }}/>
      )}
      <div style={{ position: "absolute", inset: 0, display: "flex", background: champion
        ? "linear-gradient(90deg, rgba(7,8,8,.97) 0%, rgba(7,8,8,.9) 48%, rgba(7,8,8,.2) 78%, rgba(7,8,8,.08) 100%), linear-gradient(0deg, rgba(7,8,8,.92) 0%, transparent 38%)"
        : "radial-gradient(circle at 85% 10%, #2b302d 0%, #0a0b0b 46%)" }}/>

      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 28, borderBottom: `2px solid ${LINE}` }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ width: 58, height: 64, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 20, border: `4px solid ${PAPER}`, borderRadius: 8, fontSize: 20, fontWeight: 700 }}>PNB</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 29, fontWeight: 700, letterSpacing: 5 }}>PRETO NO BRANCO</span>
            <span style={{ marginTop: 7, color: GOLD, fontSize: 19, letterSpacing: 2 }}>MONTE ELENCOS. ATRAVESSE ERAS.</span>
          </div>
        </div>
        <span style={{ ...label, color: champion ? STAR : "#e49a80" }}>{phase}</span>
      </div>

      <div style={{ position: "relative", width: champion ? 720 : "100%", display: "flex", flexDirection: "column", marginTop: 46 }}>
        <h1 style={{ margin: 0, maxWidth: 780, fontFamily: "Archive", fontSize: 88, fontWeight: 400, lineHeight: .86, letterSpacing: -2 }}>{title}</h1>

        {last && (
          <div style={{ display: "flex", alignItems: "center", marginTop: 38, padding: "24px 28px", border: `2px solid ${LINE}`, borderRadius: 14, background: "rgba(10,11,11,.82)" }}>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 250 }}>
              <span style={label}>{roundLabels[last.round]}</span>
              <span style={{ marginTop: 8, color: GOLD, fontSize: 25 }}>{last.rivalName} · {last.rivalYear}</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", marginLeft: "auto", fontFamily: "Archive", fontSize: 76, lineHeight: 1 }}>
              <b style={{ fontWeight: 400 }}>{last.user}</b><i style={{ margin: "0 20px", color: MUTED, fontFamily: "Arial", fontSize: 30, fontStyle: "normal" }}>×</i><b style={{ fontWeight: 400 }}>{last.rival}</b>
            </div>
          </div>
        )}

        <div style={{ display: "flex", marginTop: 22 }}>
          {[
            ["Overall", data.overall], ["Vitórias", data.wins], ["Formação", data.formation], ["Perfil", tacticLabels[data.tactic].name],
          ].map(([name, value], index) => (
            <div key={String(name)} style={{ minWidth: index > 1 ? 190 : 150, display: "flex", flexDirection: "column", marginRight: 12, padding: "17px 18px", border: `1px solid ${LINE}`, borderRadius: 10, background: "rgba(10,11,11,.76)" }}>
              <span style={{ ...label, fontSize: 18, letterSpacing: 2 }}>{name}</span>
              <b style={{ marginTop: 7, fontFamily: typeof value === "number" ? "Archive" : "Arial", fontSize: typeof value === "number" ? 38 : 24, fontWeight: typeof value === "number" ? 400 : 700, lineHeight: 1.05 }}>{value}</b>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: "relative", display: "flex", marginTop: "auto", padding: "28px 30px", border: `1px solid ${LINE}`, borderRadius: 14, background: "rgba(10,11,11,.88)" }}>
        <div style={{ width: "48%", display: "flex", flexDirection: "column", paddingRight: 28, borderRight: `1px solid ${LINE}` }}>
          <span style={{ ...label, color: GOLD }}>Destaques</span>
          {best.map((player) => (
            <div key={`${player.slot}-${player.name}`} style={{ display: "flex", alignItems: "center", marginTop: 13 }}>
              <span style={{ width: 70, color: MUTED, fontSize: 21 }}>{player.slot}</span>
              <b style={{ flex: 1, minWidth: 0, fontSize: 25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{player.name}</b>
              <strong style={{ marginLeft: 16, color: STAR, fontFamily: "Archive", fontSize: 35, fontWeight: 400 }}>{player.overall}</strong>
            </div>
          ))}
        </div>
        <div style={{ width: "52%", display: "flex", flexDirection: "column", paddingLeft: 30 }}>
          <span style={{ ...label, color: GOLD }}>Resumo da campanha</span>
          {data.matches.map((match) => (
            <div key={`${match.round}-${match.rivalName}`} style={{ display: "flex", alignItems: "baseline", marginTop: 13 }}>
              <span style={{ width: 130, color: MUTED, fontSize: 19 }}>{roundLabels[match.round]}</span>
              <b style={{ width: 72, color: match.won ? "#99caaa" : "#e49a80", fontFamily: "Archive", fontSize: 30, fontWeight: 400 }}>{match.user} a {match.rival}</b>
              <span style={{ flex: 1, minWidth: 0, marginLeft: 12, color: PAPER, fontSize: 21, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{match.rivalName} {match.rivalYear}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: "relative", display: "flex", justifyContent: "space-between", marginTop: 26, color: MUTED, fontSize: 19, letterSpacing: 1 }}>
        <span>pretonobranco.app</span><span>Uma campanha, onze eras.</span>
      </div>
    </div>
  );
}

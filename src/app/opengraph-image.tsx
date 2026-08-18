import { ImageResponse } from "next/og";

export const alt = "Preto no Branco";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#f1efe7";

/**
 * Capa oficial e única: prancheta branca sobre grafite e o nome centrado. Nada de placar,
 * jogador ou número, porque esta imagem serve a qualquer link do jogo.
 */
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 46, background: "#0a0b0b", color: PAPER }}>
        <svg viewBox="0 0 72 78" width={210} height={228}>
          <rect x="9.5" y="15.5" width="26.5" height="53" fill={PAPER} opacity="0.3"/>
          <rect x="7" y="13" width="58" height="58" rx="7" fill="none" stroke={PAPER} strokeWidth="5"/>
          <line x1="9.5" y1="42" x2="62.5" y2="42" stroke={PAPER} strokeWidth="3.4"/>
          <circle cx="36" cy="42" r="9" fill="none" stroke={PAPER} strokeWidth="3.4"/>
          <circle cx="36" cy="7" r="4.6" fill="none" stroke={PAPER} strokeWidth="4"/>
          <rect x="25" y="8" width="22" height="11" rx="3.5" fill={PAPER}/>
        </svg>
        <div style={{ display: "flex", fontSize: 82, fontWeight: 700, letterSpacing: 14 }}>PRETO NO BRANCO</div>
      </div>
    ),
    size,
  );
}

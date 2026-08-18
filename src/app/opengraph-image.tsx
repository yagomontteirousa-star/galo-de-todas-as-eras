import { ImageResponse } from "next/og";

export const alt = "Preto no Branco · monte elencos, atravesse eras e faça história";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#f1efe7";
const GOLD = "#d7c38e";

/** Prévia social: a mesma redução vetorial da marca, sobre o grafite da identidade. */
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px 80px", background: "#0a0b0b", color: PAPER }}>
        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <svg viewBox="0 0 72 78" width={116} height={126}>
            <rect x="9.5" y="15.5" width="26.5" height="53" fill={PAPER} opacity="0.32"/>
            <rect x="7" y="13" width="58" height="58" rx="7" fill="none" stroke={PAPER} strokeWidth="5"/>
            <line x1="9.5" y1="42" x2="62.5" y2="42" stroke={PAPER} strokeWidth="3.4"/>
            <circle cx="36" cy="42" r="9" fill="none" stroke={PAPER} strokeWidth="3.4"/>
            <circle cx="36" cy="7" r="4.6" fill="none" stroke={PAPER} strokeWidth="4"/>
            <rect x="25" y="8" width="22" height="11" rx="3.5" fill={PAPER}/>
          </svg>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 22, letterSpacing: 8, color: GOLD }}>ATLÉTICO · TODAS AS ERAS</span>
            <span style={{ fontSize: 92, fontWeight: 700, lineHeight: 1 }}>Preto no Branco</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ width: 150, height: 5, background: GOLD }}/>
          <span style={{ fontSize: 44, color: "#c8c7c0" }}>Monte elencos. Atravesse eras. Faça história.</span>
          <span style={{ fontSize: 28, color: "#8b8f8a" }}>pretonobranco.app</span>
        </div>
      </div>
    ),
    size,
  );
}

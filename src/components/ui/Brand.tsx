import Image from "next/image";

/** Acima deste tamanho a arte com respingos ainda se lê; abaixo, vira mancha. */
const GLYPH_LIMIT = 46;
const MASTER_DIGITAL_URL = "https://masterdigital.dev";

/**
 * Redução vetorial da marca: prancheta, campo e o corte preto no branco. Sem os respingos,
 * que somem em qualquer tamanho pequeno e só sujam o traço.
 */
export function PnbGlyph({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 72 78" width={size} height={Math.round(size * (78 / 72))} className={className} aria-hidden="true" focusable="false">
      {/* metade velada: o "preto" que o campo divide com o "branco", sem esconder as linhas */}
      <rect x="9.5" y="15.5" width="26.5" height="53" fill="currentColor" opacity=".32"/>
      <rect x="7" y="13" width="58" height="58" rx="7" fill="none" stroke="currentColor" strokeWidth="5"/>
      <line x1="9.5" y1="42" x2="62.5" y2="42" stroke="currentColor" strokeWidth="3.4"/>
      <circle cx="36" cy="42" r="9" fill="none" stroke="currentColor" strokeWidth="3.4"/>
      {/* prendedor da prancheta */}
      <circle cx="36" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="4"/>
      <rect x="25" y="8" width="22" height="11" rx="3.5" fill="currentColor"/>
    </svg>
  );
}

/** Marca do jogo. A arte é preta, então a versão clara é a que vive sobre o grafite. */
export function BrandMark({ size = 32, tone = "light", className }: { size?: number; tone?: "light" | "dark"; className?: string }) {
  if (size <= GLYPH_LIMIT) {
    return <PnbGlyph size={size} className={`brand-glyph brand-glyph--${tone} ${className ?? ""}`}/>;
  }
  return (
    <Image
      src={tone === "light" ? "/assets/pnb-mark-light.png" : "/assets/pnb-mark-dark.png"}
      alt=""
      width={size}
      height={Math.round(size * (387 / 360))}
      className={className}
      priority={size > 60}
    />
  );
}

export function SiteFooter() {
  const logo = <Image src="/assets/master-digital.svg" alt="Master Digital" width={126} height={36} unoptimized/>;
  return (
    <footer className="site-footer">
      {/* A faixa inteira é o link: texto e marca, com área de toque confortável. */}
      <a href={MASTER_DIGITAL_URL} target="_blank" rel="noopener noreferrer" aria-label="Desenvolvido por Master Digital, abre em nova aba">
        <span>Site desenvolvido por</span>
        {logo}
      </a>
    </footer>
  );
}

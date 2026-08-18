import Image from "next/image";

/** Marca do jogo. A arte é preta, então a versão clara é a que vive sobre o grafite. */
export function BrandMark({ size = 32, tone = "light", className }: { size?: number; tone?: "light" | "dark"; className?: string }) {
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
  return (
    <footer className="site-footer">
      <span>Desenvolvido por</span>
      <Image src="/assets/master-digital.png" alt="Master Digital" width={104} height={49}/>
    </footer>
  );
}

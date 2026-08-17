import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Galo de Todas as Eras",
  description: "Monte um Atlético histórico impossível e dispute um mata-mata contra grandes times brasileiros de outras eras.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b0c0c" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}

import type { SVGProps } from "react";

export function StarMark(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 40 40" fill="none" aria-hidden="true" {...props}><path d="M20 2.5l4.25 12.14 12.85.28-10.23 7.78 3.7 12.3L20 27.68 9.43 35l3.7-12.3L2.9 14.92l12.85-.28L20 2.5z" stroke="currentColor" strokeWidth="1.5"/><circle cx="20" cy="20" r="3" fill="currentColor"/></svg>;
}

export function ArrowIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><path d="M3 10h13M11 5l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export function ShuffleIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><path d="M14 3h3v3M3 5h3.4c3.6 0 3.6 10 7.2 10H17M14 17h3v-3M3 15h3.4c1.05 0 1.8-.85 2.45-2M11.15 7c.65-1.15 1.4-2 2.45-2H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><path d="M4 10.5l4 4L16 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>;
}

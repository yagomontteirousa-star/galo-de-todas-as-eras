/**
 * Identidade histórica do atleta: a mesma pessoa aparece em vários elencos com ids
 * diferentes (`hulk-2021-12`, `hulk-2024-12`), então a campanha precisa de uma chave que
 * atravesse os anos. O nome normalizado resolve quase tudo; as duas tabelas abaixo cobrem
 * o que ele erra, e cada entrada é justificada por posição e era dentro da própria base.
 */

/** Sem acento, sem pontuação: "Éder Aleixo" e "eder-aleixo" caem na mesma chave. */
export const slugifyName = (name: string): string =>
  name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/**
 * Apelido e nome completo do mesmo atleta. Confirmados por posição idêntica em anos
 * vizinhos, o que descarta homônimos.
 */
const ALIASES: Record<string, string> = {
  "toninho-cerezo": "cerezo",       // CM em 1976, 1977 e 1980
  "romeu-cambalhota": "romeu",      // LW em 1969 e 1971
  "eder-aleixo": "eder",            // LW em 1980, 1985 e 1995
};

/**
 * Nomes que a base usa para mais de uma pessoa. Cada número é a temporada em que começa
 * um atleta diferente, sempre com troca de função ou distância de era que descarta ser
 * o mesmo jogador.
 */
const SPLITS: Record<string, number[]> = {
  bruno: [2005],          // lateral em 1997, goleiro em 2005
  guilherme: [2012],      // centroavante em 1999, meia treze anos depois
  marquinhos: [1999, 2020], // meia em 1985, meia em 1999, ponta em 2020
  paulinho: [2024],       // ponta em 1985, centroavante trinta e nove anos depois
  adilson: [2017],        // zagueiro em 1995 e 1997, volante em 2017
  clayton: [2017],        // ponta em 1995 a 1999, outro ponta dezoito anos depois
  vanderlei: [1985],      // zagueiro em 1969 e 1971, outro em 1985
};

/**
 * Chave estável do atleta ao longo da história. Duas entradas com a mesma chave são a
 * mesma pessoa e não podem coexistir num elenco.
 */
export function personId(name: string, season: number): string {
  const base = slugifyName(name);
  const canonical = ALIASES[base] ?? base;
  const cuts = SPLITS[canonical];
  if (!cuts) return canonical;
  // Índice da faixa de anos: 0 é o atleta original, 1 o seguinte, e assim por diante.
  const index = cuts.filter((year) => season >= year).length;
  return index === 0 ? canonical : `${canonical}#${index}`;
}

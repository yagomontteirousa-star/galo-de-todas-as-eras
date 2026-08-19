/** Estádio usado pelo mandante no recorte histórico. */
const byClub: Record<string, string> = {
  Santos: "Vila Belmiro", Botafogo: "Maracanã", Palmeiras: "Pacaembu", Internacional: "Beira-Rio",
  Flamengo: "Maracanã", "Grêmio": "Olímpico", Coritiba: "Couto Pereira", "São Paulo": "Morumbi",
  Bahia: "Fonte Nova", Vasco: "São Januário", Corinthians: "Pacaembu", Cruzeiro: "Mineirão",
  "Athletico Paranaense": "Arena da Baixada", Fluminense: "Maracanã",
};

const modern: Record<string, string> = {
  "Grêmio-2017": "Arena do Grêmio", "Palmeiras-2021": "Allianz Parque", "Palmeiras-2022": "Allianz Parque",
  "Botafogo-2024": "Nilton Santos", "Cruzeiro-2019": "Mineirão", "Santos-2023": "Vila Belmiro",
};

export function stadiumFor(club: string, year: number): string {
  return modern[`${club}-${year}`] ?? byClub[club] ?? "Estádio do mandante";
}

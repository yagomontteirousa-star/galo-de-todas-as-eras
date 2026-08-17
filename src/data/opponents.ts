import { formations } from "@/data/formations";
import { calculateTeamOverall } from "@/lib/overall";
import type { Attributes, FormationId, Opponent, Player, Position, TacticId } from "@/types/game";

type OpponentSeed = [name: string, year: number, rating: number, formation: FormationId, tactic: TacticId, players: string[]];
const clamp = (value: number) => Math.max(0, Math.min(99, Math.round(value)));

function makeAttributes(position: Position, overall: number): Attributes {
  const attack = ["ST", "LW", "RW"].includes(position);
  const midfield = ["DM", "CM", "AM", "LWB", "RWB"].includes(position);
  if (position === "GK") return { finishing: 8, creation: 45, pace: 44, physical: clamp(overall - 4), defending: 35, positioning: overall, reflexes: clamp(overall + 2) };
  return {
    finishing: clamp(overall + (attack ? 3 : midfield ? -7 : -30)), creation: clamp(overall + (midfield ? 2 : attack ? -3 : -12)),
    pace: clamp(overall + (attack ? 2 : 0)), physical: clamp(overall), defending: clamp(overall + (attack ? -40 : midfield ? -5 : 3)),
    positioning: overall, reflexes: 0,
  };
}

function makeOpponent([name, year, rating, formationId, tactic, playerNames]: OpponentSeed, teamIndex: number): Opponent {
  const formation = formations[formationId];
  const lineup = formation.slots.map((slot, index): Player => {
    const variance = ((index * 3 + teamIndex) % 5) - 2;
    const overall = clamp(rating + variance);
    const attributes = makeAttributes(slot.position, overall);
    return {
      id: `opp-${teamIndex}-${index}`, name: playerNames[index], season: year,
      squadId: `opp-${teamIndex}`, primaryPosition: slot.position, secondaryPositions: [], overall, attributes,
      tags: index === 10 ? ["referência"] : ["titular"],
      styleFit: {
        balanced: clamp((attributes.positioning + attributes.creation + attributes.physical) / 3),
        attacking: clamp((attributes.finishing + attributes.creation + attributes.pace) / 3),
        defensive: clamp((attributes.defending + attributes.positioning + attributes.physical) / 3),
        pressing: clamp((attributes.pace + attributes.physical + attributes.positioning) / 3),
      },
    };
  });
  return {
    id: `opponent-${teamIndex}`, name, year, formation: formationId, tactic, lineup,
    overall: calculateTeamOverall(lineup.map((player, index) => ({ player, slotId: formation.slots[index].id })), formationId, tactic),
  };
}

const opponentSeeds: OpponentSeed[] = [
  ["Santos", 1962, 93, "4-3-3", "attacking", ["Gilmar", "Dalmo", "Mauro", "Calvet", "Lima", "Zito", "Mengálvio", "Pepe", "Pelé", "Coutinho", "Dorval"]],
  ["Botafogo", 1968, 89, "4-3-3", "attacking", ["Manga", "Valtencir", "Leônidas", "Moreira", "Fidélis", "Carlos Roberto", "Gérson", "Paulo César", "Roberto", "Jairzinho", "Rogério"]],
  ["Palmeiras", 1972, 91, "4-4-2", "balanced", ["Leão", "Zeca", "Luís Pereira", "Fedato", "Eurico", "Dudu", "Ademir da Guia", "Edu Bala", "Nei", "Leivinha", "César Maluco"]],
  ["Internacional", 1975, 89, "4-3-3", "balanced", ["Manga", "Vacaria", "Figueroa", "Hermínio", "Cláudio", "Caçapava", "Falcão", "Valdomiro", "Escurinho", "Flávio", "Lula"]],
  ["Internacional", 1979, 92, "4-3-3", "pressing", ["Benítez", "Cláudio Mineiro", "Mauro Galvão", "Mário Sérgio", "João Carlos", "Batista", "Falcão", "Jair", "Bira", "Valdomiro", "Chico Spina"]],
  ["Flamengo", 1981, 94, "4-3-3", "attacking", ["Raul", "Júnior", "Marinho", "Mozer", "Leandro", "Andrade", "Adílio", "Lico", "Nunes", "Tita", "Zico"]],
  ["Grêmio", 1983, 90, "4-4-2", "defensive", ["Mazaropi", "Casemiro", "De León", "Baidek", "Paulo Roberto", "China", "Osvaldo", "Tarciso", "Paulo César", "Caio", "Renato"]],
  ["Coritiba", 1985, 83, "4-4-2", "defensive", ["Rafael", "Dida", "Gomes", "Heraldinho", "André", "Almir", "Marco Aurélio", "Lela", "Indio", "Toquinho", "Édson"]],
  ["São Paulo", 1986, 88, "4-4-2", "balanced", ["Gilmar", "Nelsinho", "Dario Pereyra", "Oscar", "Zé Teodoro", "Falcão", "Pita", "Silas", "Müller", "Careca", "Sidney"]],
  ["Bahia", 1988, 86, "4-4-2", "defensive", ["Ronaldo", "Paulo Robson", "João Marcelo", "Claudir", "Tarântini", "Edevaldo", "Zé Carlos", "Bobô", "Gil", "Charles", "Marlon"]],
  ["Vasco", 1989, 87, "4-3-3", "balanced", ["Acácio", "Mazinho", "Quiñónez", "Marco Aurélio", "Paulo Roberto", "Andrade", "William", "Bismarck", "Bebeto", "Sorato", "Tita"]],
  ["Corinthians", 1990, 86, "4-4-2", "defensive", ["Ronaldo", "Jacenir", "Marcelo", "Guinei", "Giba", "Márcio", "Wilson Mano", "Tupãzinho", "Neto", "Fabinho", "Viola"]],
  ["São Paulo", 1992, 94, "4-3-3", "attacking", ["Zetti", "Nelsinho", "Ronaldão", "Adilson", "Cafu", "Pintado", "Raí", "Palhinha", "Müller", "Elivélton", "Macêdo"]],
  ["Palmeiras", 1993, 92, "4-4-2", "attacking", ["Sérgio", "Roberto Carlos", "Antônio Carlos", "Tonhão", "Cláudio", "César Sampaio", "Mazinho", "Zinho", "Edílson", "Evair", "Edmundo"]],
  ["Grêmio", 1995, 91, "4-4-2", "pressing", ["Danrlei", "Roger", "Adilson", "Rivarola", "Arce", "Dinho", "Goiano", "Carlos Miguel", "Arílson", "Paulo Nunes", "Jardel"]],
  ["Cruzeiro", 1997, 89, "4-4-2", "balanced", ["Dida", "Nonato", "Gélson", "Célio Lúcio", "Vítor", "Fabinho", "Ricardinho", "Palhinha", "Elivélton", "Marcelo Ramos", "Alex Mineiro"]],
  ["Vasco", 1998, 91, "4-3-3", "attacking", ["Carlos Germano", "Felipe", "Mauro Galvão", "Odvan", "Vágner", "Nasa", "Juninho", "Pedrinho", "Luizão", "Donizete", "Ramon"]],
  ["Corinthians", 1999, 92, "4-4-2", "balanced", ["Dida", "Kléber", "Gamarra", "Adílson", "Índio", "Rincón", "Vampeta", "Marcelinho", "Edílson", "Luizão", "Dinei"]],
  ["Vasco", 2000, 92, "4-3-3", "attacking", ["Hélton", "Jorginho Paulista", "Odvan", "Júnior Baiano", "Paulo Miranda", "Nasa", "Juninho", "Romário", "Viola", "Euller", "Juninho Paulista"]],
  ["Athletico Paranaense", 2001, 87, "3-5-2", "attacking", ["Flávio", "Gustavo", "Nem", "Igor", "Alessandro", "Cocito", "Kléberson", "Fabiano", "Alex Mineiro", "Kléber", "Adriano"]],
  ["Santos", 2002, 91, "4-4-2", "attacking", ["Fábio Costa", "Léo", "Alex", "André Luís", "Maurinho", "Paulo Almeida", "Renato", "Elano", "Diego", "Robinho", "Alberto"]],
  ["Cruzeiro", 2003, 94, "4-3-3", "attacking", ["Gomes", "Leandro", "Edu Dracena", "Luisão", "Maicon", "Maldonado", "Felipe Melo", "Alex", "Mota", "Aristizábal", "Deivid"]],
  ["São Paulo", 2005, 92, "3-5-2", "balanced", ["Rogério Ceni", "Fabão", "Lugano", "Edcarlos", "Júnior", "Mineiro", "Josué", "Cicinho", "Danilo", "Amoroso", "Aloísio"]],
  ["Internacional", 2006, 91, "4-4-2", "balanced", ["Clemer", "Rubens Cardoso", "Índio", "Fabiano Eller", "Ceará", "Edinho", "Fabinho", "Alex", "Fernandão", "Iarley", "Rafael Sóbis"]],
  ["Fluminense", 2010, 88, "4-2-3-1", "balanced", ["Diego Cavalieri", "Carlinhos", "Leandro Euzébio", "Gum", "Mariano", "Diguinho", "Diogo", "Conca", "Emerson", "Marquinho", "Fred"]],
  ["Corinthians", 2012, 91, "4-2-3-1", "defensive", ["Cássio", "Fábio Santos", "Chicão", "Paulo André", "Alessandro", "Ralf", "Paulinho", "Danilo", "Jorge Henrique", "Emerson", "Guerrero"]],
  ["Cruzeiro", 2014, 91, "4-2-3-1", "attacking", ["Fábio", "Egídio", "Dedé", "Léo", "Mayke", "Lucas Silva", "Henrique", "Éverton Ribeiro", "Willian", "Ricardo Goulart", "Marcelo Moreno"]],
  ["Grêmio", 2017, 92, "4-2-3-1", "balanced", ["Marcelo Grohe", "Cortez", "Kannemann", "Geromel", "Edílson", "Arthur", "Maicon", "Luan", "Fernandinho", "Ramiro", "Lucas Barrios"]],
  ["Flamengo", 2019, 96, "4-2-3-1", "attacking", ["Diego Alves", "Filipe Luís", "Pablo Marí", "Rodrigo Caio", "Rafinha", "Willian Arão", "Gerson", "Arrascaeta", "Bruno Henrique", "Éverton Ribeiro", "Gabigol"]],
  ["Palmeiras", 2021, 93, "4-2-3-1", "defensive", ["Weverton", "Piquerez", "Gustavo Gómez", "Luan", "Marcos Rocha", "Danilo", "Zé Rafael", "Raphael Veiga", "Dudu", "Rony", "Luiz Adriano"]],
  ["Fluminense", 2023, 91, "4-2-3-1", "pressing", ["Fábio", "Marcelo", "Felipe Melo", "Nino", "Samuel Xavier", "André", "Martinelli", "Ganso", "Keno", "Jhon Arias", "Cano"]],
];

export const opponents: Opponent[] = opponentSeeds.map(makeOpponent);

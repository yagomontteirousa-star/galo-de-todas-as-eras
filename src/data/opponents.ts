import { formations } from "@/data/formations";
import { calculateTeamOverall } from "@/lib/overall";
import { attributesForOverall, styleFitFor } from "@/lib/player-rating";
import { stadiumFor } from "@/data/stadiums";
import type { FormationId, Opponent, Player, TacticId } from "@/types/game";

type OpponentPlayerSeed = [name: string, overall: number];
type OpponentSeed = [name: string, year: number, formation: FormationId, tactic: TacticId, players: OpponentPlayerSeed[]];

function makeOpponent([name, year, formationId, tactic, playerSeeds]: OpponentSeed, teamIndex: number): Opponent {
  const formation = formations[formationId];
  if (playerSeeds.length !== formation.slots.length) throw new Error(`${name} ${year}: o onze rival precisa ter 11 jogadores`);
  const lineup = formation.slots.map((slot, index): Player => {
    const [playerName, overall] = playerSeeds[index];
    const attributes = attributesForOverall(slot.position, overall);
    return {
      // Adversário não entra no bloqueio de repetidos: a chave é única por vaga.
      id: `opp-${teamIndex}-${index}`, name: playerName, season: year, personId: `opp-${teamIndex}-${index}`,
      squadId: `opp-${teamIndex}`, primaryPosition: slot.position, secondaryPositions: [], overall, attributes,
      tags: index === 10 ? ["referência"] : ["titular"],
      styleFit: styleFitFor(attributes),
    };
  });
  return {
    id: `opponent-${teamIndex}`, name, year, formation: formationId, tactic, lineup,
    stadium: stadiumFor(name, year),
    overall: calculateTeamOverall(lineup.map((player, index) => ({ player, slotId: formation.slots[index].id })), formationId, tactic),
  };
}

/**
 * Notas individuais na mesma escala do arquivo do Atlético: 93+ é uma temporada de
 * referência histórica; 89–92 identifica protagonistas de elite; 84–88, titulares
 * fortes; 79–83, peças funcionais; abaixo disso, somente contextos realmente modestos.
 * A ordem acompanha as onze vagas da formação para preservar posição e peso setorial.
 */
const opponentSeeds: OpponentSeed[] = [
  ["Santos", 1962, "4-3-3", "attacking", [["Gilmar", 92], ["Dalmo", 84], ["Mauro", 89], ["Calvet", 85], ["Lima", 86], ["Zito", 89], ["Mengálvio", 85], ["Pepe", 91], ["Pelé", 98], ["Coutinho", 92], ["Dorval", 87]]],
  ["Botafogo", 1968, "4-3-3", "attacking", [["Manga", 90], ["Valtencir", 82], ["Leônidas", 85], ["Moreira", 82], ["Fidélis", 84], ["Carlos Roberto", 86], ["Gérson", 94], ["Paulo César", 89], ["Roberto", 88], ["Rogério", 84], ["Jairzinho", 95]]],
  ["Palmeiras", 1972, "4-4-2", "balanced", [["Leão", 91], ["Zeca", 81], ["Luís Pereira", 93], ["Fedato", 84], ["Eurico", 84], ["Edu Bala", 86], ["Dudu", 89], ["Ademir da Guia", 95], ["Nei", 83], ["Leivinha", 90], ["César Maluco", 88]]],
  ["Internacional", 1975, "4-3-3", "balanced", [["Manga", 90], ["Vacaria", 81], ["Figueroa", 94], ["Hermínio", 83], ["Cláudio", 82], ["Caçapava", 86], ["Falcão", 91], ["Escurinho", 84], ["Lula", 84], ["Flávio", 88], ["Valdomiro", 89]]],
  ["Internacional", 1979, "4-3-3", "pressing", [["Benítez", 89], ["Cláudio Mineiro", 84], ["Mauro Pastor", 84], ["Mauro Galvão", 90], ["João Carlos", 84], ["Batista", 90], ["Falcão", 94], ["Jair", 87], ["Mário Sérgio", 91], ["Bira", 87], ["Valdomiro", 90]]],
  ["Flamengo", 1981, "4-3-3", "attacking", [["Raul", 86], ["Júnior", 92], ["Marinho", 84], ["Mozer", 87], ["Leandro", 92], ["Andrade", 86], ["Adílio", 89], ["Zico", 97], ["Lico", 85], ["Nunes", 90], ["Tita", 87]]],
  ["Grêmio", 1983, "4-4-2", "defensive", [["Mazaropi", 86], ["Casemiro", 80], ["De León", 93], ["Baidek", 82], ["Paulo Roberto", 83], ["China", 82], ["Osvaldo", 82], ["Tarciso", 87], ["Paulo César", 84], ["Caio", 83], ["Renato", 92]]],
  ["Coritiba", 1985, "4-4-2", "defensive", [["Rafael", 82], ["Dida", 77], ["Gomes", 80], ["Heraldinho", 78], ["André", 79], ["Almir", 78], ["Marco Aurélio", 82], ["Lela", 86], ["Indio", 80], ["Toquinho", 79], ["Édson", 84]]],
  ["São Paulo", 1986, "4-4-2", "balanced", [["Gilmar", 87], ["Nelsinho", 84], ["Dario Pereyra", 92], ["Oscar", 88], ["Zé Teodoro", 83], ["Sidney", 82], ["Falcão", 87], ["Pita", 90], ["Silas", 86], ["Müller", 89], ["Careca", 94]]],
  ["Bahia", 1988, "4-4-2", "defensive", [["Ronaldo", 81], ["Paulo Robson", 77], ["João Marcelo", 79], ["Claudir", 80], ["Tarântini", 79], ["Edevaldo", 81], ["Zé Carlos", 80], ["Bobô", 89], ["Gil", 79], ["Charles", 82], ["Marlon", 85]]],
  ["Vasco", 1989, "4-3-3", "balanced", [["Acácio", 88], ["Mazinho", 90], ["Quiñónez", 83], ["Marco Aurélio", 84], ["Paulo Roberto", 82], ["Andrade", 85], ["William", 83], ["Bismarck", 89], ["Bebeto", 94], ["Sorato", 88], ["Tita", 86]]],
  ["Corinthians", 1990, "4-4-2", "defensive", [["Ronaldo", 85], ["Jacenir", 76], ["Marcelo", 79], ["Guinei", 80], ["Giba", 78], ["Márcio", 81], ["Wilson Mano", 80], ["Tupãzinho", 84], ["Fabinho", 81], ["Neto", 93], ["Viola", 85]]],
  ["São Paulo", 1992, "4-3-3", "attacking", [["Zetti", 92], ["Nelsinho", 86], ["Ronaldão", 88], ["Adilson", 84], ["Cafu", 91], ["Pintado", 86], ["Raí", 95], ["Palhinha", 91], ["Müller", 92], ["Elivélton", 86], ["Macêdo", 84]]],
  ["Palmeiras", 1993, "4-4-2", "attacking", [["Sérgio", 86], ["Roberto Carlos", 91], ["Antônio Carlos", 88], ["Tonhão", 82], ["Cláudio", 84], ["César Sampaio", 90], ["Mazinho", 88], ["Zinho", 90], ["Edílson", 89], ["Evair", 92], ["Edmundo", 91]]],
  ["Grêmio", 1995, "4-4-2", "pressing", [["Danrlei", 89], ["Roger", 84], ["Adilson", 87], ["Rivarola", 86], ["Arce", 90], ["Dinho", 86], ["Goiano", 84], ["Carlos Miguel", 89], ["Arílson", 84], ["Paulo Nunes", 91], ["Jardel", 93]]],
  ["Cruzeiro", 1997, "4-4-2", "balanced", [["Dida", 92], ["Nonato", 81], ["Gélson", 82], ["Célio Lúcio", 83], ["Vítor", 84], ["Fabinho", 82], ["Ricardinho", 86], ["Palhinha", 88], ["Elivélton", 83], ["Marcelo Ramos", 90], ["Alex Mineiro", 85]]],
  ["Vasco", 1998, "4-3-3", "attacking", [["Carlos Germano", 90], ["Felipe", 89], ["Mauro Galvão", 88], ["Odvan", 84], ["Vágner", 82], ["Nasa", 84], ["Juninho", 93], ["Pedrinho", 91], ["Ramon", 88], ["Luizão", 90], ["Donizete", 89]]],
  ["Corinthians", 1999, "4-4-2", "balanced", [["Dida", 93], ["Kléber", 85], ["Gamarra", 94], ["Adílson", 84], ["Índio", 82], ["Rincón", 92], ["Vampeta", 91], ["Marcelinho", 94], ["Edílson", 92], ["Luizão", 91], ["Dinei", 82]]],
  ["Vasco", 2000, "4-3-3", "attacking", [["Hélton", 87], ["Jorginho Paulista", 84], ["Odvan", 84], ["Júnior Baiano", 87], ["Paulo Miranda", 82], ["Nasa", 84], ["Juninho", 93], ["Juninho Paulista", 92], ["Euller", 88], ["Romário", 96], ["Viola", 86]]],
  ["Athletico Paranaense", 2001, "3-5-2", "attacking", [["Flávio", 84], ["Gustavo", 82], ["Nem", 83], ["Igor", 82], ["Alessandro", 86], ["Cocito", 83], ["Kléberson", 90], ["Fabiano", 84], ["Alex Mineiro", 89], ["Kléber", 91], ["Adriano", 86]]],
  ["Santos", 2002, "4-4-2", "attacking", [["Fábio Costa", 87], ["Léo", 89], ["Alex", 90], ["André Luís", 84], ["Maurinho", 83], ["Paulo Almeida", 84], ["Renato", 87], ["Elano", 88], ["Diego", 92], ["Robinho", 93], ["Alberto", 85]]],
  ["Cruzeiro", 2003, "4-3-3", "attacking", [["Gomes", 90], ["Leandro", 85], ["Edu Dracena", 89], ["Luisão", 91], ["Maicon", 90], ["Maldonado", 88], ["Felipe Melo", 84], ["Alex", 96], ["Mota", 88], ["Aristizábal", 88], ["Deivid", 91]]],
  ["São Paulo", 2005, "3-5-2", "balanced", [["Rogério Ceni", 93], ["Fabão", 86], ["Lugano", 91], ["Edcarlos", 83], ["Júnior", 88], ["Mineiro", 91], ["Josué", 88], ["Cicinho", 92], ["Danilo", 90], ["Amoroso", 91], ["Aloísio", 86]]],
  ["Internacional", 2006, "4-4-2", "balanced", [["Clemer", 87], ["Rubens Cardoso", 82], ["Índio", 89], ["Fabiano Eller", 87], ["Ceará", 85], ["Edinho", 86], ["Fabinho", 84], ["Alex", 88], ["Fernandão", 93], ["Iarley", 89], ["Rafael Sóbis", 91]]],
  ["Fluminense", 2010, "4-2-3-1", "balanced", [["Diego Cavalieri", 86], ["Carlinhos", 84], ["Leandro Euzébio", 83], ["Gum", 85], ["Mariano", 87], ["Diguinho", 84], ["Diogo", 82], ["Emerson", 85], ["Conca", 94], ["Marquinho", 84], ["Fred", 91]]],
  ["Corinthians", 2012, "4-2-3-1", "defensive", [["Cássio", 92], ["Fábio Santos", 87], ["Chicão", 88], ["Paulo André", 85], ["Alessandro", 84], ["Ralf", 90], ["Paulinho", 92], ["Jorge Henrique", 86], ["Danilo", 88], ["Emerson", 91], ["Guerrero", 88]]],
  ["Cruzeiro", 2014, "4-2-3-1", "attacking", [["Fábio", 91], ["Egídio", 86], ["Dedé", 88], ["Léo", 84], ["Mayke", 86], ["Lucas Silva", 88], ["Henrique", 87], ["Willian", 88], ["Éverton Ribeiro", 94], ["Ricardo Goulart", 93], ["Marcelo Moreno", 88]]],
  ["Grêmio", 2017, "4-2-3-1", "balanced", [["Marcelo Grohe", 92], ["Cortez", 84], ["Kannemann", 91], ["Geromel", 93], ["Edílson", 87], ["Arthur", 93], ["Maicon", 89], ["Fernandinho", 85], ["Luan", 94], ["Ramiro", 88], ["Lucas Barrios", 87]]],
  ["Flamengo", 2019, "4-2-3-1", "attacking", [["Diego Alves", 87], ["Filipe Luís", 91], ["Pablo Marí", 84], ["Rodrigo Caio", 87], ["Rafinha", 88], ["Willian Arão", 85], ["Gerson", 88], ["Bruno Henrique", 94], ["Arrascaeta", 93], ["Éverton Ribeiro", 91], ["Gabigol", 94]]],
  ["Palmeiras", 2021, "4-2-3-1", "defensive", [["Weverton", 92], ["Piquerez", 86], ["Gustavo Gómez", 93], ["Luan", 85], ["Marcos Rocha", 88], ["Danilo", 90], ["Zé Rafael", 87], ["Dudu", 91], ["Raphael Veiga", 93], ["Rony", 88], ["Luiz Adriano", 84]]],
  ["Fluminense", 2023, "4-2-3-1", "pressing", [["Fábio", 89], ["Marcelo", 87], ["Felipe Melo", 83], ["Nino", 89], ["Samuel Xavier", 85], ["André", 92], ["Martinelli", 86], ["Keno", 87], ["Ganso", 88], ["Jhon Arias", 92], ["Cano", 93]]],
  ["Cruzeiro", 1966, "4-3-3", "attacking", [["Raul Plassmann", 90], ["Neco", 84], ["Procópio", 88], ["William", 86], ["Piazza", 92], ["Zé Carlos", 84], ["Dirceu Lopes", 94], ["Natal", 87], ["Tostão", 96], ["Evaldo", 88], ["Hilton Oliveira", 84]]],
  ["Palmeiras", 1967, "4-3-3", "balanced", [["Valdir de Moraes", 88], ["Djalma Santos", 91], ["Baldocchi", 88], ["Minuca", 83], ["Dé", 86], ["Dudu", 90], ["Ademir da Guia", 94], ["Rinaldo", 86], ["César Maluco", 89], ["Servílio", 86], ["Eduardo", 85]]],
  ["Flamengo", 1987, "4-4-2", "attacking", [["Zé Carlos", 85], ["Jorginho", 91], ["Aldair", 90], ["Leandro", 91], ["Leonardo", 89], ["Andrade", 87], ["Aílton", 83], ["Zico", 95], ["Zinho", 88], ["Bebeto", 93], ["Renato Gaúcho", 91]]],
  ["Grêmio", 1996, "4-4-2", "pressing", [["Danrlei", 90], ["Arce", 91], ["Rivarola", 88], ["Adílson", 88], ["Roger", 85], ["Dinho", 88], ["Goiano", 85], ["Carlos Miguel", 89], ["Aílton", 85], ["Paulo Nunes", 91], ["Jardel", 94]]],
  ["Vasco", 1997, "4-3-3", "attacking", [["Carlos Germano", 90], ["Felipe", 90], ["Mauro Galvão", 90], ["Odvan", 85], ["Vágner", 84], ["Nasa", 83], ["Ramon", 89], ["Pedrinho", 90], ["Edmundo", 96], ["Evair", 90], ["Luisinho", 84]]],
  ["Corinthians", 2000, "4-4-2", "balanced", [["Dida", 91], ["Kléber", 85], ["Gamarra", 92], ["Adílson", 84], ["Índio", 82], ["Rincón", 90], ["Vampeta", 89], ["Ricardinho", 89], ["Marcelinho", 92], ["Edílson", 89], ["Luizão", 89]]],
  ["São Paulo", 2006, "3-5-2", "balanced", [["Rogério Ceni", 94], ["Fabão", 86], ["Lugano", 91], ["Edcarlos", 84], ["Júnior", 87], ["Mineiro", 90], ["Josué", 88], ["Ilsinho", 87], ["Danilo", 89], ["Aloísio", 88], ["Leandro", 86]]],
  ["Santos", 2011, "4-4-2", "attacking", [["Rafael", 89], ["Léo", 87], ["Edu Dracena", 88], ["Durval", 85], ["Danilo", 91], ["Arouca", 89], ["Henrique", 86], ["Elano", 90], ["Ganso", 93], ["Neymar", 96], ["Borges", 89]]],
  ["Flamengo", 2022, "4-2-3-1", "attacking", [["Santos", 86], ["Filipe Luís", 89], ["Léo Pereira", 88], ["David Luiz", 88], ["Rodinei", 87], ["João Gomes", 89], ["Thiago Maia", 85], ["Éverton Ribeiro", 90], ["Arrascaeta", 94], ["Gabigol", 92], ["Pedro", 92]]],
  ["Palmeiras", 2022, "4-2-3-1", "defensive", [["Weverton", 92], ["Piquerez", 88], ["Gustavo Gómez", 93], ["Murilo", 88], ["Marcos Rocha", 87], ["Danilo", 91], ["Zé Rafael", 89], ["Dudu", 92], ["Raphael Veiga", 94], ["Rony", 89], ["Endrick", 86]]],
  ["Botafogo", 2024, "4-2-3-1", "pressing", [["John", 89], ["Cuiabano", 85], ["Bastos", 89], ["Adryelson", 88], ["Vitinho", 84], ["Marlon Freitas", 88], ["Gregore", 89], ["Luiz Henrique", 92], ["Savarino", 90], ["Thiago Almada", 93], ["Igor Jesus", 88]]],
  ["Botafogo", 2002, "4-4-2", "defensive", [["Diego", 79], ["Alessandro", 78], ["Sandro", 80], ["André Luís", 79], ["Luciano Almeida", 77], ["Galeano", 81], ["Ramon", 80], ["Rodrigo Beckham", 79], ["Serginho", 80], ["Túlio", 83], ["Dodô", 86]]],
  ["Grêmio", 2004, "4-4-2", "defensive", [["Galatto", 81], ["Cláudio", 77], ["Baloy", 82], ["Marinho", 78], ["Fábio Pinto", 78], ["Tinga", 84], ["Jeovânio", 79], ["Ricardinho", 81], ["Cláudio Pitbull", 82], ["Christian", 83], ["Anderson", 80]]],
  ["Corinthians", 2007, "4-4-2", "defensive", [["Felipe", 85], ["Betão", 80], ["Zelão", 77], ["Fábio Ferreira", 78], ["Gustavo Nery", 81], ["Magrão", 82], ["Rosinei", 81], ["Carlos Alberto", 84], ["Lulinha", 80], ["Everton Santos", 81], ["Finazzi", 82]]],
  ["Vasco", 2008, "4-4-2", "balanced", [["Tiago", 80], ["Wagner Diniz", 80], ["Eduardo Luiz", 78], ["Luizão", 79], ["Calisto", 78], ["Jonílson", 81], ["Madson", 84], ["Morais", 82], ["Alex Teixeira", 84], ["Leandro Amaral", 84], ["Edmundo", 82]]],
  ["Internacional", 2016, "4-2-3-1", "balanced", [["Danilo Fernandes", 86], ["Artur", 80], ["Ernando", 81], ["Paulão", 79], ["William", 84], ["Rodrigo Dourado", 85], ["Anselmo", 80], ["Valdívia", 83], ["Anderson", 81], ["Vitinho", 85], ["Aylon", 78]]],
  ["Cruzeiro", 2019, "4-2-3-1", "balanced", [["Fábio", 88], ["Egídio", 80], ["Dedé", 86], ["Léo", 82], ["Orejuela", 82], ["Henrique", 83], ["Lucas Silva", 84], ["Thiago Neves", 84], ["Robinho", 80], ["Pedro Rocha", 81], ["Fred", 85]]],
  ["Santos", 2023, "4-2-3-1", "attacking", [["João Paulo", 87], ["Dodô", 80], ["Joaquim", 82], ["Messias", 79], ["Lucas Braga", 78], ["Dodi", 81], ["Rodrigo Fernández", 81], ["Lucas Lima", 83], ["Soteldo", 86], ["Marcos Leonardo", 87], ["Mendoza", 82]]],
];

export const opponents: Opponent[] = opponentSeeds.map(makeOpponent);

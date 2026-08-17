import type { Attributes, HistoricalSquad, Player, Position, TacticId } from "@/types/game";

type Seed = [name: string, position: Position, overall: number, secondary?: Position[], tags?: string[]];

const clamp = (value: number) => Math.max(0, Math.min(99, Math.round(value)));

function attributesFor(position: Position, overall: number): Attributes {
  const delta = overall - 80;
  const profiles: Record<Position, Attributes> = {
    GK: { finishing: 8, creation: 42, pace: 40, physical: 75, defending: 30, positioning: 84, reflexes: 86 },
    CB: { finishing: 38, creation: 57, pace: 68, physical: 84, defending: 86, positioning: 82, reflexes: 0 },
    LB: { finishing: 52, creation: 72, pace: 82, physical: 76, defending: 77, positioning: 78, reflexes: 0 },
    RB: { finishing: 52, creation: 72, pace: 82, physical: 76, defending: 77, positioning: 78, reflexes: 0 },
    LWB: { finishing: 61, creation: 76, pace: 84, physical: 77, defending: 70, positioning: 78, reflexes: 0 },
    RWB: { finishing: 61, creation: 76, pace: 84, physical: 77, defending: 70, positioning: 78, reflexes: 0 },
    DM: { finishing: 55, creation: 75, pace: 70, physical: 82, defending: 83, positioning: 83, reflexes: 0 },
    CM: { finishing: 68, creation: 84, pace: 73, physical: 76, defending: 71, positioning: 82, reflexes: 0 },
    AM: { finishing: 78, creation: 88, pace: 79, physical: 68, defending: 42, positioning: 85, reflexes: 0 },
    LW: { finishing: 80, creation: 84, pace: 87, physical: 69, defending: 38, positioning: 84, reflexes: 0 },
    RW: { finishing: 80, creation: 84, pace: 87, physical: 69, defending: 38, positioning: 84, reflexes: 0 },
    ST: { finishing: 89, creation: 72, pace: 80, physical: 83, defending: 30, positioning: 88, reflexes: 0 },
  };
  return Object.fromEntries(Object.entries(profiles[position]).map(([key, value]) => [key, clamp(value + delta)])) as unknown as Attributes;
}

function fitFor(attributes: Attributes): Record<TacticId, number> {
  return {
    balanced: clamp((attributes.positioning + attributes.creation + attributes.physical) / 3),
    attacking: clamp((attributes.finishing + attributes.creation + attributes.pace) / 3),
    defensive: clamp((attributes.defending + attributes.positioning + attributes.physical) / 3),
    pressing: clamp((attributes.pace + attributes.physical + attributes.positioning) / 3),
  };
}

function createSquad(year: number, name: string, context: string, seeds: Seed[]): HistoricalSquad {
  const squadId = `atletico-${year}`;
  const players = seeds.map(([playerName, primaryPosition, overall, secondaryPositions = [], tags = []], index): Player => {
    const attributes = attributesFor(primaryPosition, overall);
    return {
      id: `${playerName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${year}-${index}`,
      name: playerName,
      season: year,
      squadId,
      primaryPosition,
      secondaryPositions,
      overall,
      attributes,
      tags: tags.length ? tags : primaryPosition === "GK" ? ["reflexos"] : primaryPosition === "ST" ? ["finalizador"] : ["regular"],
      styleFit: fitFor(attributes),
    };
  });
  return { id: squadId, year, name, context, players };
}

const s = (name: string, position: Position, overall: number, secondary: Position[] = [], tags: string[] = []): Seed => [name, position, overall, secondary, tags];

export const atleticoSquads: HistoricalSquad[] = [
  createSquad(1969, "A base do grande ciclo", "Uma geração que ajudou a preparar o terreno para a conquista nacional.", [
    s("Renato", "GK", 82), s("Tião", "GK", 74), s("Grapete", "CB", 83, [], ["liderança"]), s("Vantuir", "CB", 82), s("Oldair", "LB", 81), s("Getúlio", "RB", 80),
    s("Vanderlei", "CB", 76), s("Humberto Ramos", "DM", 82), s("Zé Carlos", "CM", 81), s("Beto", "CM", 78), s("Hélio", "AM", 77), s("Spencer", "RW", 79),
    s("Dario", "ST", 87, [], ["artilheiro", "presença de área"]), s("Romeu", "LW", 80), s("Vaguinho", "RW", 79), s("Lola", "ST", 77), s("Amauri", "CM", 75), s("Nivaldo", "LB", 74),
  ]),
  createSquad(1971, "Campeão Brasileiro", "O elenco da primeira conquista do Campeonato Brasileiro.", [
    s("Renato", "GK", 86, [], ["seguro"]), s("Careca", "GK", 76), s("Grapete", "CB", 86, [], ["liderança", "jogo aéreo"]), s("Vantuir", "CB", 85), s("Oldair", "LB", 84), s("Getúlio", "RB", 83),
    s("Paulo Isidoro", "CM", 84, ["AM"], ["dinâmico"]), s("Humberto Ramos", "DM", 84), s("Zé Carlos", "CM", 83), s("Beto", "AM", 80), s("Romeu Cambalhota", "LW", 83), s("Vaguinho", "RW", 84),
    s("Dario", "ST", 91, [], ["decisivo", "artilheiro"]), s("Lola", "ST", 79), s("Spencer", "RW", 78), s("Vanderlei", "CB", 78), s("Amauri", "DM", 77), s("Nivaldo", "LB", 75),
  ]),
  createSquad(1976, "Retomada continental", "Um time físico e competitivo no início de uma era marcante.", [
    s("Ortiz", "GK", 83), s("Marcelo", "GK", 76), s("Márcio", "CB", 84), s("Silvestre", "CB", 82), s("Ângelo", "RB", 81), s("Alfinete", "LB", 79),
    s("Vantuir", "CB", 80), s("Chicão", "DM", 86, [], ["combativo"]), s("Cerezo", "CM", 88, ["DM"], ["classe", "controle"]), s("Marcelo Oliveira", "AM", 84), s("Paulo Isidoro", "CM", 86, ["AM"]), s("Danival", "CM", 78),
    s("Reinaldo", "ST", 90, [], ["gênio", "decisivo"]), s("Sérgio Araújo", "RW", 82), s("Ziza", "LW", 81), s("Campos", "ST", 78), s("Pedrinho", "LW", 76), s("Joãozinho", "RB", 75),
  ]),
  createSquad(1977, "Invicto de 1977", "Uma campanha nacional invicta, lembrada pela força coletiva e pelo brilho ofensivo.", [
    s("João Leite", "GK", 88, [], ["reflexos", "decisivo"]), s("Ortiz", "GK", 81), s("Márcio", "CB", 86), s("Silvestre", "CB", 84), s("Ângelo", "RB", 83), s("Alfinete", "LB", 82),
    s("Vantuir", "CB", 80), s("Chicão", "DM", 87, [], ["combativo"]), s("Cerezo", "CM", 91, ["DM"], ["classe", "controle"]), s("Marcelo Oliveira", "AM", 86), s("Paulo Isidoro", "CM", 88, ["AM"]), s("Danival", "CM", 79),
    s("Reinaldo", "ST", 94, [], ["gênio", "artilheiro"]), s("Sérgio Araújo", "RW", 85), s("Ziza", "LW", 83), s("Campos", "ST", 80), s("Pedrinho", "LW", 78), s("Joãozinho", "RB", 76),
  ]),
  createSquad(1980, "Finalista Brasileiro", "Uma das formações mais técnicas da história alvinegra chegou à decisão nacional.", [
    s("João Leite", "GK", 89, [], ["decisivo"]), s("Montezuma", "GK", 77), s("Luisinho", "CB", 89, [], ["elegante"]), s("Osmar Guarnelli", "CB", 85), s("Nelinho", "RB", 89, [], ["bola parada"]), s("Jorge Valença", "LB", 83),
    s("Silvestre", "CB", 80), s("Toninho Cerezo", "CM", 93, ["DM"], ["maestro"]), s("Palhinha", "AM", 87), s("Paulo Isidoro", "CM", 90, ["AM"]), s("Chicão", "DM", 86), s("Heleno", "CM", 81),
    s("Reinaldo", "ST", 95, [], ["gênio", "decisivo"]), s("Éder", "LW", 92, ["ST"], ["potência", "canhota"]), s("Sérgio Araújo", "RW", 84), s("Pedrinho", "LW", 79), s("Campos", "ST", 78), s("Geraldão", "ST", 77),
  ]),
  createSquad(1985, "Força dos anos 80", "Técnica no meio e imposição em mais uma equipe competitiva da década.", [
    s("João Leite", "GK", 88), s("Gaspar", "GK", 77), s("Luisinho", "CB", 88), s("Vanderlei", "CB", 83), s("Edivaldo", "RB", 83, ["RW"]), s("Jorge Valença", "LB", 82),
    s("Nílson", "CB", 79), s("Elzo", "DM", 87, [], ["marcador"]), s("Paulo Isidoro", "CM", 87, ["AM"]), s("Éverton", "AM", 84), s("Heleno", "CM", 82), s("Marquinhos", "CM", 78),
    s("Reinaldo", "ST", 90), s("Éder", "LW", 90, ["ST"]), s("Sérgio Araújo", "RW", 84), s("Almir", "ST", 81), s("Paulinho", "LW", 78), s("Marcus Vinícius", "ST", 77),
  ]),
  createSquad(1995, "Conmebol 1995", "Um elenco aguerrido que manteve a tradição continental do clube.", [
    s("Taffarel", "GK", 91, [], ["campeão do mundo"]), s("Milagres", "GK", 79), s("Adílson", "CB", 85), s("Cléber", "CB", 84), s("Paulo Roberto", "RB", 80), s("Paulo César", "LB", 79),
    s("Gelson", "CB", 77), s("Doriva", "DM", 84), s("Sérgio Araújo", "AM", 82), s("Euller", "RW", 85, ["ST"], ["velocidade"]), s("Valdir", "CM", 80), s("Gutemberg", "DM", 78),
    s("Reinaldo", "ST", 84), s("Renaldo", "ST", 86, [], ["artilheiro"]), s("Éder Aleixo", "LW", 83), s("Marques", "ST", 82, ["RW"]), s("Clayton", "LW", 79), s("Gérson", "ST", 76),
  ]),
  createSquad(1997, "Centenário em formação", "Talento ofensivo e transição veloz no fim da década.", [
    s("Taffarel", "GK", 90), s("Milagres", "GK", 80), s("Cléber", "CB", 85), s("Adílson", "CB", 83), s("Bruno", "RB", 80), s("Dedimar", "LB", 78),
    s("Gelson", "CB", 77), s("Doriva", "DM", 85), s("Lincoln", "AM", 84), s("Valdir", "CM", 81), s("Gutemberg", "DM", 79), s("Djair", "CM", 78),
    s("Marques", "ST", 87, ["RW"], ["técnico"]), s("Valdir Bigode", "ST", 86), s("Euller", "RW", 87, ["ST"], ["velocidade"]), s("Clayton", "LW", 81), s("Renaldo", "ST", 82), s("Alex Alves", "LW", 80),
  ]),
  createSquad(1999, "Vice-campeão Brasileiro", "Ataque memorável e campanha eletrizante até a final nacional.", [
    s("Velloso", "GK", 87, [], ["liderança"]), s("Milagres", "GK", 78), s("Cláudio Caçapa", "CB", 87), s("Galván", "CB", 84), s("Cicinho", "RB", 82), s("André Santos", "LB", 80),
    s("Luiz Eduardo", "CB", 78), s("Gallo", "DM", 85), s("Lincoln", "AM", 86, [], ["criação"]), s("Marquinhos", "CM", 82), s("Robert", "AM", 81), s("Gutemberg", "DM", 79),
    s("Guilherme", "ST", 92, [], ["artilheiro", "decisivo"]), s("Marques", "ST", 90, ["RW"], ["técnico"]), s("Valdir Bigode", "ST", 86), s("Euller", "RW", 85, ["ST"]), s("Clayton", "LW", 80), s("Alex Alves", "LW", 79),
  ]),
  createSquad(2005, "Temporada de reconstrução", "Uma equipe irregular, mas com nomes de qualidade e forte identidade ofensiva.", [
    s("Danrlei", "GK", 82), s("Bruno", "GK", 78), s("Marcos", "CB", 82), s("Lima", "CB", 81), s("George Lucas", "RB", 79), s("Rubens Cardoso", "LB", 82),
    s("Wellington Paulo", "CB", 77), s("Zé Antônio", "DM", 80), s("Rodrigo Fabri", "AM", 84), s("Ataliba", "CM", 79), s("Tchô", "AM", 78), s("Xaves", "DM", 77),
    s("Marques", "ST", 87, ["RW"]), s("Euller", "RW", 84, ["ST"]), s("Uéslei", "ST", 82), s("Fábio Júnior", "ST", 81), s("Danilinho", "LW", 80), s("Catanha", "ST", 78),
  ]),
  createSquad(2012, "O prenúncio da América", "A campanha de recuperação que reuniu a base do time campeão continental.", [
    s("Victor", "GK", 90, [], ["decisivo"]), s("Giovanni", "GK", 77), s("Réver", "CB", 89, [], ["liderança"]), s("Leonardo Silva", "CB", 87), s("Marcos Rocha", "RB", 86, ["RWB"]), s("Júnior César", "LB", 82),
    s("Rafael Marques", "CB", 79), s("Pierre", "DM", 86, [], ["combativo"]), s("Leandro Donizete", "DM", 85, ["CM"]), s("Ronaldinho", "AM", 93, ["LW"], ["gênio", "criação"]), s("Bernard", "LW", 89, ["AM"]), s("Danilinho", "RW", 84),
    s("Jô", "ST", 88), s("Guilherme", "AM", 85, ["ST"]), s("Neto Berola", "RW", 81), s("André", "ST", 80), s("Escudero", "AM", 79), s("Richarlyson", "LB", 80, ["DM"]),
  ]),
  createSquad(2013, "Libertadores 2013", "A equipe que conquistou a América em noites históricas no Independência.", [
    s("Victor", "GK", 94, [], ["santo", "decisivo"]), s("Giovanni", "GK", 78), s("Réver", "CB", 91, [], ["capitão", "jogo aéreo"]), s("Leonardo Silva", "CB", 90), s("Marcos Rocha", "RB", 89, ["RWB"], ["apoio"]), s("Richarlyson", "LB", 84, ["DM"]),
    s("Rafael Marques", "CB", 80), s("Pierre", "DM", 88, [], ["combativo"]), s("Leandro Donizete", "DM", 87, ["CM"]), s("Ronaldinho", "AM", 95, ["LW"], ["gênio", "maestro"]), s("Bernard", "LW", 91, ["AM"], ["drible"]), s("Josué", "DM", 84),
    s("Jô", "ST", 91, [], ["artilheiro"]), s("Diego Tardelli", "ST", 92, ["RW"], ["decisivo"]), s("Luan", "RW", 86, ["ST"], ["intensidade"]), s("Guilherme", "AM", 86, ["ST"]), s("Alecsandro", "ST", 82), s("Neto Berola", "RW", 80),
  ]),
  createSquad(2014, "Copa do Brasil 2014", "Viradas improváveis e uma equipe que transformou desvantagens em combustível.", [
    s("Victor", "GK", 92), s("Giovanni", "GK", 78), s("Leonardo Silva", "CB", 90), s("Jemerson", "CB", 87), s("Marcos Rocha", "RB", 89, ["RWB"]), s("Douglas Santos", "LB", 86, ["LWB"]),
    s("Réver", "CB", 86), s("Leandro Donizete", "DM", 87), s("Josué", "DM", 84), s("Dátolo", "AM", 88, ["CM"], ["criação"]), s("Maicosuel", "LW", 84), s("Marion", "RW", 78),
    s("Diego Tardelli", "ST", 93, ["RW"], ["decisivo"]), s("Luan", "RW", 88, ["ST"], ["intensidade"]), s("Carlos", "ST", 83), s("Guilherme", "AM", 87, ["ST"]), s("Jô", "ST", 84), s("André", "ST", 80),
  ]),
  createSquad(2017, "Ataque de estrelas", "Um elenco de grande força individual buscando transformar talento em domínio.", [
    s("Victor", "GK", 89), s("Giovanni", "GK", 77), s("Leonardo Silva", "CB", 87), s("Gabriel", "CB", 84), s("Marcos Rocha", "RB", 87), s("Fábio Santos", "LB", 86),
    s("Felipe Santana", "CB", 81), s("Rafael Carioca", "CM", 87, ["DM"], ["passe"]), s("Adilson", "DM", 84), s("Cazares", "AM", 88), s("Elias", "CM", 86), s("Otero", "AM", 85, ["LW"], ["bola parada"]),
    s("Fred", "ST", 88, [], ["artilheiro"]), s("Robinho", "LW", 89, ["ST"]), s("Luan", "RW", 86, ["ST"]), s("Rafael Moura", "ST", 82), s("Clayton", "LW", 80), s("Valdívia", "AM", 80),
  ]),
  createSquad(2020, "A arrancada nacional", "Um time agressivo que abriu caminho para a temporada dominante seguinte.", [
    s("Éverson", "GK", 87, [], ["jogo com os pés"]), s("Rafael", "GK", 82), s("Junior Alonso", "CB", 88, ["LB"]), s("Réver", "CB", 86), s("Guga", "RB", 82), s("Guilherme Arana", "LB", 89, ["LWB"]),
    s("Igor Rabello", "CB", 82), s("Allan", "DM", 86), s("Jair", "CM", 85, ["DM"]), s("Nacho Fernández", "AM", 88, ["CM"]), s("Alan Franco", "CM", 83), s("Hyoran", "AM", 82),
    s("Keno", "LW", 89, ["RW"], ["drible"]), s("Eduardo Sasha", "ST", 84, ["LW"]), s("Marrony", "ST", 82, ["RW"]), s("Savarino", "RW", 87, ["LW"]), s("Diego Tardelli", "ST", 84), s("Marquinhos", "LW", 79),
  ]),
  createSquad(2021, "Tríplice coroa 2021", "Uma temporada dominante com títulos estadual, nacional e da Copa do Brasil.", [
    s("Éverson", "GK", 91, [], ["jogo com os pés", "seguro"]), s("Rafael", "GK", 82), s("Junior Alonso", "CB", 91, ["LB"], ["liderança"]), s("Nathan Silva", "CB", 87), s("Mariano", "RB", 86), s("Guilherme Arana", "LB", 92, ["LWB"], ["apoio"]),
    s("Réver", "CB", 85), s("Allan", "DM", 89), s("Jair", "CM", 88, ["DM"]), s("Nacho Fernández", "AM", 91, ["CM"], ["criação"]), s("Zaracho", "CM", 90, ["AM"], ["intensidade"]), s("Tchê Tchê", "CM", 83, ["DM"]),
    s("Hulk", "ST", 94, ["RW"], ["decisivo", "artilheiro"]), s("Keno", "LW", 90, ["RW"]), s("Diego Costa", "ST", 87), s("Savarino", "RW", 88, ["LW"]), s("Eduardo Vargas", "ST", 85, ["RW"]), s("Eduardo Sasha", "ST", 82, ["LW"]),
  ]),
  createSquad(2024, "Finalista continental 2024", "Um elenco experiente que voltou a disputar as maiores decisões do continente.", [
    s("Éverson", "GK", 90, [], ["jogo com os pés"]), s("Matheus Mendes", "GK", 81), s("Junior Alonso", "CB", 89, ["LB"]), s("Battaglia", "CB", 88, ["DM"]), s("Saravia", "RB", 85, ["RWB"]), s("Guilherme Arana", "LB", 91, ["LWB"]),
    s("Bruno Fuchs", "CB", 83), s("Otávio", "DM", 87), s("Alan Franco", "CM", 86, ["DM"]), s("Gustavo Scarpa", "AM", 89, ["RW"], ["criação", "bola parada"]), s("Zaracho", "CM", 87, ["AM"]), s("Igor Gomes", "AM", 83, ["CM"]),
    s("Hulk", "ST", 93, ["RW"], ["decisivo", "artilheiro"]), s("Paulinho", "ST", 90, ["LW"], ["mobilidade"]), s("Deyverson", "ST", 86), s("Bernard", "LW", 86, ["AM"]), s("Alisson", "RW", 81), s("Cadu", "ST", 79, ["RW"]),
  ]),
];

export const playersById = new Map(atleticoSquads.flatMap((squad) => squad.players).map((player) => [player.id, player]));
export const squadsById = new Map(atleticoSquads.map((squad) => [squad.id, squad]));

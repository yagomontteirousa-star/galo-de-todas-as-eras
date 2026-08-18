import { describe, expect, it } from "vitest";
import { atleticoSquads, playersById, squadsById } from "@/data/atletico-squads";
import { personId } from "@/data/player-identity";
import { formations } from "@/data/formations";
import { createCampaign, nextAvailableSquad, startDraft, usedPersonIds } from "@/lib/campaign";
import { evaluatePosition } from "@/lib/overall";
import { seededRandom } from "@/lib/simulation";
import type { Campaign, FormationId, LineupEntry } from "@/types/game";

const canPlay = (playerId: string, slotId: string, formation: FormationId) => {
  const player = playersById.get(playerId)!;
  const slot = formations[formation].slots.find((item) => item.id === slotId)!;
  return evaluatePosition(player, slot).fit !== "improvised";
};

/** Reproduz o laço do draft: sorteia o ano, escolhe até dois nomes, repete até fechar o onze. */
function playDraft(formation: FormationId, random: () => number): Campaign {
  let campaign = startDraft(createCampaign(), formation, "balanced", "visible", random);
  let guard = 0;
  while (campaign.lineup.length < 11 && guard++ < 60) {
    const squad = campaign.currentSquadId ? squadsById.get(campaign.currentSquadId) : undefined;
    if (!squad) break;
    const used = usedPersonIds(campaign.lineup);
    const taken = new Set(campaign.lineup.map((entry) => entry.slotId));
    const open = formations[formation].slots.filter((slot) => !taken.has(slot.id));
    const picks: LineupEntry[] = [];
    const maxPicks = Math.min(2, 11 - campaign.lineup.length);
    for (const player of squad.players) {
      if (picks.length >= maxPicks) break;
      if (used.has(player.personId)) continue;
      const slot = open.find((item) =>
        !picks.some((pick) => pick.slotId === item.id) && evaluatePosition(player, item).fit !== "improvised");
      if (!slot) continue;
      picks.push({ slotId: slot.id, playerId: player.id, squadId: squad.id });
      used.add(player.personId);
    }
    const usedSquadIds = [...campaign.usedSquadIds, squad.id];
    campaign = { ...campaign, lineup: [...campaign.lineup, ...picks], usedSquadIds, currentSquadId: undefined };
    campaign = { ...campaign, currentSquadId: nextAvailableSquad(campaign, random)?.id };
  }
  return campaign;
}

describe("um atleta por campanha", () => {
  it("dá a mesma identidade ao atleta em anos diferentes", () => {
    expect(personId("Hulk", 2021)).toBe(personId("Hulk", 2024));
    expect(personId("Réver", 2012)).toBe(personId("Réver", 2021));
    // apelido e nome completo do mesmo jogador
    expect(personId("Cerezo", 1977)).toBe(personId("Toninho Cerezo", 1980));
    expect(personId("Romeu", 1969)).toBe(personId("Romeu Cambalhota", 1971));
    expect(personId("Éder", 1980)).toBe(personId("Éder Aleixo", 1995));
    // acento e caixa não criam um segundo atleta
    expect(personId("EDER", 1980)).toBe(personId("Éder", 1980));
  });

  it("não junta homônimos que a base usa para pessoas diferentes", () => {
    expect(personId("Bruno", 1997)).not.toBe(personId("Bruno", 2005));
    expect(personId("Paulinho", 1985)).not.toBe(personId("Paulinho", 2024));
    expect(personId("Adilson", 1995)).not.toBe(personId("Adilson", 2017));
    // Reinaldo e Renaldo continuam sendo dois atletas
    expect(personId("Reinaldo", 1995)).not.toBe(personId("Renaldo", 1995));
  });

  it("fecha o onze sem repetir ninguém, em qualquer formação e sorteio", () => {
    const formationIds = Object.keys(formations) as FormationId[];
    for (const formation of formationIds) {
      for (let seed = 1; seed <= 40; seed += 1) {
        const campaign = playDraft(formation, seededRandom(seed * 977 + formation.length));
        expect(campaign.lineup.length, `${formation} seed ${seed} não fechou o onze`).toBe(11);
        const people = campaign.lineup.map((entry) => playersById.get(entry.playerId)!.personId);
        expect(new Set(people).size, `${formation} seed ${seed} repetiu atleta`).toBe(11);
        // toda peça segue numa vaga que ela cobre de verdade
        campaign.lineup.forEach((entry) => expect(canPlay(entry.playerId, entry.slotId, formation)).toBe(true));
      }
    }
  });

  it("libera todos os atletas quando a campanha é nova", () => {
    expect(usedPersonIds(createCampaign().lineup).size).toBe(0);
  });

  it("mantém a identidade estável em toda a base", () => {
    atleticoSquads.flatMap((squad) => squad.players).forEach((player) => {
      expect(player.personId).toBe(personId(player.name, player.season));
    });
  });
});

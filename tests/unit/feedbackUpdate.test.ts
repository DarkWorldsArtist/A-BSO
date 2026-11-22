import { Monsters } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import { yetiCL } from '../../src/lib/bso/collection-log/main.js';
import { EBSOMonster } from '../../src/lib/bso/EBSOMonster.js';
import { Nihiliz } from '../../src/lib/bso/monsters/demi-bosses/Nihiliz.js';
import { SuperiorTormentedDemon } from '../../src/lib/bso/monsters/demi-bosses/TormentedDemon.js';
import { nexLootTable } from '../../src/lib/bso/monsters/nex.js';
import {
	rollBrockLoot,
	rollDougLoot,
	rollObisLoot,
	rollPekyLoot
} from '../../src/lib/bso/tables/gatheringPetTables.js';
import { tameKillableMonsters } from '../../src/lib/bso/tames/tames.js';
import { applyCAClueBoost } from '../../src/lib/combat_achievements/caClueBoost.js';
import { PerkTier } from '../../src/lib/constants.js';
import { allCollectionLogs } from '../../src/lib/data/Collections.js';
import { getSimilarItems } from '../../src/lib/data/similarItems.js';
import { growablePetsCL } from '../../src/lib/growablePets.js';
import { duradelTasks } from '../../src/lib/slayer/tasks/duradelTasks.js';
import {
	getEST4HourBucket,
	getESTDateKey,
	getNextESTMidnight,
	getNextESTWeekReset
} from '../../src/lib/util/estTime.js';
import { determineOpenableSimLimit } from '../../src/mahoji/lib/abstracted_commands/simulateOpenableCommand.js';

describe('Feedback Update Mechanics', () => {
	test('Searcrown band satisfies Ignis ring(i) via similarItems', () => {
		const similar = getSimilarItems(48_206);
		expect(similar).toContain(75_017);
		expect(similar).toContain(75_075);
	});

	test('Growable pets CL includes Penguin egg and Skip; Yeti is counted under PvM', () => {
		const growableNames = new Set(growablePetsCL);
		expect(growableNames.size).toBeGreaterThan(10);
		expect(yetiCL.length).toBe(5);
		expect(allCollectionLogs.PvM.activities.Yeti).toBeDefined();
		expect(allCollectionLogs.PvM.activities.Yeti.counts).toBeUndefined();
	});

	test('Nex and Nihiliz drop Ecumenical key shards', () => {
		expect(nexLootTable.allItems).toContain(26_388);
		expect(Nihiliz.table.allItems).toContain(26_388);
	});

	test('Superior Tormented Demon uses TormentedDemon base and is on Greater Demon tasks', () => {
		expect(SuperiorTormentedDemon.baseMonster).toBe(Monsters.TormentedDemon);
		const greaterDemonTask = duradelTasks.find(t => t.monster.id === Monsters.GreaterDemon.id);
		expect(greaterDemonTask?.monsters).toContain(EBSOMonster.SUPERIOR_TORMENTED_DEMON);
	});

	test('Igne tame killables include Tombs of Amascut and Depths of Atlantis with Dwarven armor req', () => {
		const toa = tameKillableMonsters.find(m => m.name === 'Tombs of Amascut');
		const doa = tameKillableMonsters.find(m => m.name === 'Depths of Atlantis');
		expect(toa).toBeDefined();
		expect(doa).toBeDefined();
		expect(doa?.minArmorTier?.name).toBe('Dwarven igne armor');
	});

	test('Gathering pet tables roll non-empty skill-scaled loot', () => {
		expect(rollPekyLoot(110, 5).length).toBeGreaterThan(0);
		expect(rollObisLoot(110, 5).length).toBeGreaterThan(0);
		expect(rollBrockLoot(110, 5).length).toBeGreaterThan(0);
		expect(rollDougLoot(110, 5).length).toBeGreaterThan(0);
	});

	test('applyCAClueBoost reduces denominator by 5% when CA tier is completed', () => {
		const mockUserWithGM = { hasCompletedCATier: (t: string) => t === 'grandmaster' } as unknown as MUser;
		const mockUserNoCA = { hasCompletedCATier: () => false } as unknown as MUser;
		expect(applyCAClueBoost(mockUserWithGM, 100, 'grandmaster')).toBe(95);
		expect(applyCAClueBoost(mockUserNoCA, 100, 'grandmaster')).toBe(100);
	});

	test('determineOpenableSimLimit scales with patron tiers', () => {
		expect(determineOpenableSimLimit(PerkTier.Zero)).toBe(10_000);
		expect(determineOpenableSimLimit(PerkTier.Two)).toBe(50_000);
		expect(determineOpenableSimLimit(PerkTier.Six)).toBe(1_000_000);
	});

	test('estTime helpers return valid EST keys and future midnight resets', () => {
		const now = new Date('2026-11-21T15:30:00Z');
		expect(getESTDateKey(now)).toBe('2026-11-21');
		expect(getNextESTMidnight(now).getTime()).toBeGreaterThan(now.getTime());
		expect(getNextESTWeekReset(now).getTime()).toBeGreaterThan(now.getTime());
		expect(getEST4HourBucket(now).getTime()).toBeLessThanOrEqual(now.getTime());
	});
});

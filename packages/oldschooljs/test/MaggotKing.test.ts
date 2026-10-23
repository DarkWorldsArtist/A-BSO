import { randArrItem, roll } from 'node-rng';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { EMonster } from '@/EMonster.js';
import { MonsterSlayerMaster } from '@/meta/monsterData.js';
import { MaggotKing, MaggotKingCommonTable, MaggotKingNormalTable } from '@/simulation/monsters/bosses/MaggotKing.js';
import { Monsters } from '@/simulation/monsters/index.js';
import Openables from '@/simulation/openables/index.js';
import { MaggotEggs, maggotEggRates } from '@/simulation/openables/MaggotEgg.js';
import { Items } from '@/structures/Items.js';

vi.mock('node-rng', async importOriginal => ({
	...(await importOriginal<typeof import('node-rng')>()),
	roll: vi.fn(),
	randArrItem: vi.fn()
}));

beforeEach(() => {
	vi.mocked(roll).mockReset().mockReturnValue(false);
	// Last slot: common table, then Tarnished 2h sword.
	vi.mocked(randArrItem)
		.mockReset()
		.mockImplementation(arr => arr[arr.length - 1]);
});

describe('Maggot King normal rewards', () => {
	test('is registered under the enum ID and advertises all its possible rewards', () => {
		expect(Monsters.get(EMonster.MAGGOT_KING)).toBe(MaggotKing);
		for (const name of [
			'Elder venator fang',
			'Crimson kisten',
			'Maggot marquess',
			'Brimstone key',
			'Clue scroll (elite)'
		]) {
			expect(MaggotKing.allItems).toContain(Items.getId(name));
		}
	});

	test('keeps exact unique rates without reducing the second unique chance', () => {
		const [fang, kisten, common] = MaggotKingNormalTable.table;
		expect(fang.item).toBe(Items.getId('Elder venator fang'));
		expect(kisten.item).toBe(Items.getId('Crimson kisten'));
		expect(fang.weight! / MaggotKingNormalTable.totalWeight).toBe(1 / 340);
		expect(kisten.weight! / MaggotKingNormalTable.totalWeight).toBe(1 / 520);
		expect(common.item).toBe(MaggotKingCommonTable);
		expect(MaggotKingCommonTable.totalWeight).toBe(159);
	});

	test('awards a unique instead of common resources', () => {
		vi.mocked(randArrItem).mockImplementation(arr => arr[0]);
		const loot = MaggotKing.kill();
		expect(loot.amount('Elder venator fang')).toBe(1);
		expect(loot.length).toBe(1);
	});

	test('awards both supplies together, with the correct quantity range', () => {
		vi.mocked(randArrItem)
			.mockImplementationOnce(arr => arr[arr.length - 1])
			.mockImplementationOnce(arr => arr[0]);
		const loot = MaggotKing.kill();
		expect(loot.amount('Dull ancient medal')).toBe(1);
		expect(loot.amount('Stymphike tartare')).toBeGreaterThanOrEqual(2);
		expect(loot.amount('Stymphike tartare')).toBeLessThanOrEqual(4);
		expect(loot.length).toBe(2);
	});

	test('handles zero, default and multiple kills', () => {
		expect(MaggotKing.kill(0).length).toBe(0);
		expect(MaggotKing.kill().amount('Tarnished 2h sword')).toBe(1);
		expect(MaggotKing.kill(5).amount('Tarnished 2h sword')).toBe(5);
	});

	test('rolls the pet and clue independently of the main reward', () => {
		vi.mocked(roll).mockReturnValue(true);
		const loot = MaggotKing.kill(3);
		expect(loot.amount('Maggot marquess')).toBe(3);
		expect(loot.amount('Clue scroll (elite)')).toBe(3);
		expect(loot.amount('Tarnished 2h sword')).toBe(3);
		expect(loot.amount('Brimstone key')).toBe(0);
	});

	test('only rolls brimstone keys on a Konar task', () => {
		vi.mocked(roll).mockReturnValue(true);
		expect(MaggotKing.kill(2, { slayerMaster: MonsterSlayerMaster.Konar }).amount('Brimstone key')).toBe(0);
		expect(
			MaggotKing.kill(2, { onSlayerTask: true, slayerMaster: MonsterSlayerMaster.Duradel }).amount(
				'Brimstone key'
			)
		).toBe(0);
		expect(
			MaggotKing.kill(2, { onSlayerTask: true, slayerMaster: MonsterSlayerMaster.Konar }).amount('Brimstone key')
		).toBe(2);
	});

	test('preserves elite clue rate adjustments supplied by the bot', () => {
		MaggotKing.kill(1, {
			lootTableOptions: { tertiaryItemPercentageChanges: new Map([['Clue scroll (elite)', 5]]) }
		});
		expect(roll).toHaveBeenCalledWith(38);
	});
});

describe('Maggot eggs', () => {
	test.each(maggotEggRates)('$variant egg resolves to its verified item and pet rate', ({ id, variant, petRate }) => {
		const egg = Openables.get(id)!;
		expect(egg.name).toBe('Maggot egg (' + variant + ')');
		expect(Items.getId(egg.name)).toBe(id);
		vi.mocked(roll).mockReturnValue(true);
		expect(egg.open(3, {}).amount('Maggot marquess')).toBe(3);
		expect(roll).toHaveBeenCalledWith(petRate);
	});

	test('can pop without receiving any reward, including writhing eggs', () => {
		for (const egg of MaggotEggs) {
			expect(egg.open(1).length).toBe(0);
			expect(egg.open(0).length).toBe(0);
		}
	});

	test('retains unconditional egg weights rather than normalizing them to guaranteed eggs', () => {
		const petChance = maggotEggRates.reduce((sum, egg) => sum + egg.weight / 1500 / egg.petRate, 0);
		expect(1 / petChance).toBeCloseTo(1502.40384615, 6);
		expect(maggotEggRates.reduce((sum, egg) => sum + egg.weight, 0)).toBe(493);
	});
});

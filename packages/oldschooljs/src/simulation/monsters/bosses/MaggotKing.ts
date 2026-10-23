import { EMonster } from '@/EMonster.js';
import { MonsterSlayerMaster } from '@/meta/monsterData.js';
import { Bank } from '@/structures/Bank.js';
import LootTable from '@/structures/LootTable.js';
import { Monster, type MonsterKillOptions } from '@/structures/Monster.js';

// https://oldschool.runescape.wiki/w/Maggot_King (23 October 2026).
// Supplies are awarded together; the common table has 159 weighted slots.
const SupplyTable = new LootTable().every('Stymphike tartare', [2, 4]).every('Dull ancient medal');
const BrimstoneTable = new LootTable().tertiary(50, 'Brimstone key');

export const MaggotKingCommonTable: LootTable = new LootTable({ limit: 159 })
	.add(SupplyTable, 1, 41)
	.add('Uncut ruby', [10, 13], 15)
	.add('Stymphike feather', [51, 74], 10)
	.add('Mort myre fungus', [50, 76], 10)
	.add('Letvek', [23, 34], 10)
	.add('Runite ore', [12, 15], 5)
	.add('Blood sac', [8, 11], 5)
	.add('Gold ore', [24, 32], 5)
	.add('Mithril ore', [36, 41], 5)
	.add('Adamantite ore', [30, 40], 10)
	.add('Orikalkum gravel', [4, 5], 4)
	.add('Venator fang', [112, 179], 2)
	.add('Venator tooth', [178, 219], 2)
	.add('Tarnished spear', 1, 12)
	.add('Tarnished ring', 1, 6)
	.add('Tarnished bracelet', 1, 3)
	.add('Tarnished necklace', 1, 3)
	.add('Tarnished amulet', 1, 3)
	.add('Tarnished battleaxe', 1, 2)
	.add('Tarnished longsword', 1, 2)
	.add('Tarnished halberd', 1, 2)
	.add('Tarnished 2h sword', 1, 2);

// One roll gives mutually exclusive uniques with exact marginal rates:
// 26/8840 = 1/340 and 17/8840 = 1/520. Sequential oneIn rolls bias the second.
export const MaggotKingNormalTable: LootTable = new LootTable({ limit: 8840 })
	.add('Elder venator fang', 1, 26)
	.add('Crimson kisten', 1, 17)
	.add(MaggotKingCommonTable, 1, 8797)
	.tertiary(3500, 'Maggot marquess')
	.tertiary(40, 'Clue scroll (elite)');

class MaggotKingSingleton extends Monster {
	public kill(quantity = 1, options: MonsterKillOptions = {}): Bank {
		const loot = new Bank();
		MaggotKingNormalTable.roll(quantity, { ...options.lootTableOptions, targetBank: loot });
		if (options.onSlayerTask && options.slayerMaster === MonsterSlayerMaster.Konar) {
			BrimstoneTable.roll(quantity, { targetBank: loot });
		}
		return loot;
	}
}

export const MaggotKing: MaggotKingSingleton = new MaggotKingSingleton({
	id: EMonster.MAGGOT_KING,
	name: 'Maggot King',
	aliases: ['maggot king', 'maggotking'],
	allItems: [...MaggotKingNormalTable.allItems, ...BrimstoneTable.allItems]
});

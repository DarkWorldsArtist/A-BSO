import { MysteryBoxes } from '@/lib/bso/openables/tables.js';

import { Bank, LootTable } from 'oldschooljs';

const RareTable = new LootTable()
	.add('Hornwood helm')
	.add('Hand fan')
	.add('Mask of balance')
	.add('Druidic wreath')
	.add('Disk of returning');

const UncommonTable = new LootTable()
	.add(RareTable)
	.add('Tiger toy')
	.add('Lion toy')
	.add('Snow leopard toy')
	.add('Amur leopard toy')
	.add('Holy handegg')
	.add('Peaceful handegg')
	.add('Chaotic handegg')
	.add('Rainbow scarf')
	.add("Diango's claws");

const CommonTable = new LootTable()
	.add('Goblin paint cannon', 1, 2)
	.add('Green banner', 1, 2)
	.add('Spinning plate', [1, 20])
	.add('Brown toy horsey')
	.add('White toy horsey')
	.add('Black toy horsey')
	.add('Grey toy horsey')
	.add(11_705)
	.add(11_706)
	.add(UncommonTable);

const IronmanDailySupplyTable = new LootTable()
	.add('Grimy ranarr weed', [8, 20])
	.add('Grimy snapdragon', [6, 15])
	.add('Death rune', [150, 400])
	.add('Blood rune', [100, 300])
	.add('Soul rune', [100, 250])
	.add('Pure essence', [500, 1500])
	.add('Dragon bones', [15, 35])
	.add('Ranarr seed', [2, 6])
	.add('Snapdragon seed', [1, 4])
	.add('Clue scroll (hard)', 1)
	.add('Clue scroll (elite)', 1);

const DailyTable = new LootTable()
	.every('Coins', [1_500_000, 3_500_000])
	.add('Coins', [500_000, 2_000_000])
	.add(UncommonTable)
	.add(CommonTable, 1, 2)
	.add(MysteryBoxes, 1, 2);

export function rollIronmanDailySupplies(rolls = 2): Bank {
	return IronmanDailySupplyTable.roll(rolls);
}

export default function dailyRoll(qty = 1, correct = false) {
	const loot = new Bank();
	loot.add(DailyTable.roll(qty));
	if (correct) {
		loot.add(CommonTable.roll(qty)).add(DailyTable.roll(2)).add(MysteryBoxes.roll());
	}
	return loot;
}

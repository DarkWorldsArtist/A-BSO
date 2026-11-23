import { hasUnlockedAtlantis } from '@/lib/bso/bsoUtil.js';
import { divinationEnergies } from '@/lib/bso/skills/divination.js';
import { HighRuneTable, RuneTable, WilvusTable, WoodTable } from '@/lib/bso/tables/seedTable.js';
import { DougTable, ExoticSeedsTable } from '@/lib/bso/tables/sharedTables.js';

import { randInt, roll } from 'node-rng';
import { Bank, LootTable } from 'oldschooljs';

import { HighSeedPackTable, LowSeedPackTable, MediumSeedPackTable } from '@/lib/data/seedPackTables.js';
import { nestTable } from '@/lib/simulation/birdsNest.js';

const PekyHighCustomSeeds = new LootTable()
	.add('Spirit weed seed', 1, 8)
	.add('Advax berry seed', 1, 8)
	.add('Morchella mushroom spore', 1, 6)
	.add('Mysterious seed', 1, 2);

const PekyMasterCustomSeeds = new LootTable()
	.add('Athelas seed', 1, 5)
	.add('Korulsi seed', 1, 5)
	.add('Tombshroom spore', 1, 4)
	.add('Polypore spore', 1, 4)
	.add('Ivy seed', 1, 1);

export function rollPekyLoot(farmingLevel: number, rolls: number): Bank {
	const loot = new Bank();
	for (let i = 0; i < rolls; i++) {
		if (roll(2)) loot.add(nestTable.roll());
		if (farmingLevel >= 105) {
			loot.add(roll(2) ? HighSeedPackTable.roll() : MediumSeedPackTable.roll());
			if (roll(4)) loot.add(ExoticSeedsTable.roll());
			if (roll(6)) loot.add(PekyHighCustomSeeds.roll());
			if (roll(10)) loot.add(PekyMasterCustomSeeds.roll());
		} else if (farmingLevel >= 99) {
			loot.add(roll(4) ? HighSeedPackTable.roll() : MediumSeedPackTable.roll());
			if (roll(5)) loot.add(ExoticSeedsTable.roll());
			if (roll(8)) loot.add(PekyHighCustomSeeds.roll());
		} else if (farmingLevel >= 70) {
			loot.add(roll(3) ? HighSeedPackTable.roll() : MediumSeedPackTable.roll());
			if (roll(6)) loot.add(ExoticSeedsTable.roll());
		} else {
			loot.add(roll(3) ? MediumSeedPackTable.roll() : LowSeedPackTable.roll());
		}
		if (roll(5)) loot.add('Breadcrumbs');
		if (roll(500)) loot.add('Baby raven');
	}
	return loot;
}

const ComboRuneTable = new LootTable()
	.add('Mist rune', [15, 45])
	.add('Dust rune', [15, 45])
	.add('Mud rune', [15, 45])
	.add('Smoke rune', [15, 45])
	.add('Steam rune', [15, 45])
	.add('Lava rune', [15, 45]);

export function rollObisLoot(rcLevel: number, rolls: number): Bank {
	const loot = new Bank();
	for (let i = 0; i < rolls; i++) {
		if (rcLevel >= 99 && roll(8)) {
			loot.add('Elder rune', rcLevel >= 110 ? randInt(2, 7) : randInt(1, 4));
		} else if (rcLevel >= 77 && roll(2)) {
			if (rcLevel >= 95 && roll(4)) {
				loot.add('Wrath rune', randInt(15, 40));
			} else if (roll(2)) {
				loot.add('Blood rune', randInt(20, 50));
			} else {
				loot.add(HighRuneTable.roll());
			}
		} else if (rcLevel >= 54 && roll(3)) {
			loot.add(roll(2) ? HighRuneTable.roll() : ComboRuneTable.roll());
		} else {
			loot.add(RuneTable.roll());
		}
	}
	return loot;
}

export function rollBrockLoot(wcLevel: number, rolls: number): Bank {
	const loot = new Bank();
	for (let i = 0; i < rolls; i++) {
		if (wcLevel >= 105 && roll(7)) {
			loot.add('Elder logs', randInt(3, 12));
		} else if (wcLevel >= 90 && roll(3)) {
			loot.add('Redwood logs', randInt(10, 30));
		} else if (wcLevel >= 75 && roll(3)) {
			loot.add(roll(2) ? 'Magic logs' : 'Yew logs', randInt(10, 30));
		} else {
			loot.add(WoodTable.roll());
		}
	}
	return loot;
}

export function rollDougLoot(miningLevel: number, rolls: number): Bank {
	const loot = new Bank();
	for (let i = 0; i < rolls; i++) {
		if (miningLevel >= 105 && roll(7)) {
			loot.add('Dark animica', randInt(4, 12));
		} else if (miningLevel >= 80 && roll(6)) {
			loot.add('Obsidian shards', randInt(12, 35));
		} else if (miningLevel >= 85 && roll(3)) {
			loot.add(roll(2) ? 'Runite ore' : 'Amethyst', randInt(4, 15));
		} else {
			loot.add(DougTable.roll());
		}
	}
	return loot;
}

export function rollDoopyLoot(user: MUser, rolls: number): Bank {
	const loot = new Bank();
	const divLevel = user.skillLevel('divination');
	const unlocked = divinationEnergies.filter(
		e => divLevel >= e.level && (!('hasReq' in e) || e.hasReq(user) === null)
	);
	const pool = unlocked.length > 0 ? unlocked.slice(-3) : [divinationEnergies[0]];
	const atlantisBonus = hasUnlockedAtlantis(user) ? 1.1 : 1;

	for (let i = 0; i < rolls; i++) {
		const rollWeight = randInt(1, 100);
		const picked =
			pool.length === 1
				? pool[0]
				: pool.length === 2
					? rollWeight <= 65
						? pool[1]
						: pool[0]
					: rollWeight <= 55
						? pool[2]
						: rollWeight <= 85
							? pool[1]
							: pool[0];
		const baseQty = randInt(10, 25) + Math.floor(divLevel / 8);
		loot.add(picked.item.id, Math.max(1, Math.round(baseQty * atlantisBonus)));
	}
	return loot;
}

export function rollWilvusLoot(thievingLevel: number, rolls: number): Bank {
	const loot = new Bank();
	for (let i = 0; i < rolls; i++) {
		loot.add(WilvusTable.roll());
		if (thievingLevel >= 105) {
			if (roll(2)) loot.add('Coins', randInt(40_000, 100_000));
			if (roll(5)) loot.add('Crystal shard', randInt(1, 4));
			if (roll(6)) loot.add(HighSeedPackTable.roll());
		} else if (thievingLevel >= 99) {
			if (roll(2)) loot.add('Coins', randInt(25_000, 70_000));
			if (roll(6)) loot.add('Crystal shard', randInt(1, 3));
		} else if (thievingLevel >= 80 && roll(3)) {
			loot.add('Coins', randInt(15_000, 45_000));
		}
	}
	return loot;
}

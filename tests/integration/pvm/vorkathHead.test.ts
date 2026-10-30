import { MathRNG } from 'node-rng';
import { Bank, Monsters } from 'oldschooljs';
import { expect, it, vi } from 'vitest';

import killableMonsters from '@/lib/minions/data/killableMonsters/index.js';
import { getUsersCurrentSlayerInfo } from '@/lib/slayer/slayerUtil.js';
import { KCBank } from '@/lib/structures/KCBank.js';
import { doMonsterTrip } from '@/tasks/minions/monsterActivity.js';
import { createTestUser } from '../util.js';

it.each([
	{ startingKC: 48, quantity: 1, expectedHeads: 0 },
	{ startingKC: 49, quantity: 1, expectedHeads: 1 },
	{ startingKC: 47, quantity: 5, expectedHeads: 1 },
	{ startingKC: 50, quantity: 1, expectedHeads: 0 },
	{ startingKC: 99, quantity: 1, expectedHeads: 0 },
	{ startingKC: 49, quantity: 1, expectedHeads: 1, randomHead: true },
	{ startingKC: 49, quantity: 0, expectedHeads: 0 }
])('awards $expectedHeads guaranteed heads from $startingKC KC over $quantity kills', async ({
	startingKC,
	quantity,
	expectedHeads,
	randomHead
}) => {
	const user = await createTestUser();
	const monster = killableMonsters.find(m => m.id === Monsters.Vorkath.id)!;
	const slayerInfo = await getUsersCurrentSlayerInfo(user.id);
	const kill = vi
		.spyOn(monster.table, 'kill')
		.mockImplementation((killQuantity = 1) =>
			new Bank()
				.add('Superior dragon bones', killQuantity * 2)
				.add("Vorkath's head", randomHead ? killQuantity : 0)
		);

	try {
		const result = doMonsterTrip({
			type: 'MonsterKilling',
			monster: { ...monster, deathProps: undefined },
			q: quantity,
			duration: 60_000,
			hasEliteCA: false,
			hasKourendHard: false,
			hasKourendElite: false,
			kcBank: new KCBank().add(Monsters.Vorkath.id, startingKC),
			gearBank: user.gearBank,
			slayerInfo,
			slayerUnlocks: [],
			tertiaryItemPercentageChanges: new Map<string, number>(),
			attackStyles: ['attack'],
			bitfield: [],
			cl: new Bank(),
			rng: MathRNG
		});

		expect(result.newKC).toBe(startingKC + quantity);
		expect(result.updateBank.itemLootBank.amount("Vorkath's head")).toBe(expectedHeads);
		expect(result.updateBank.itemLootBank.amount('Superior dragon bones')).toBe(quantity * 2);
	} finally {
		kill.mockRestore();
	}
});

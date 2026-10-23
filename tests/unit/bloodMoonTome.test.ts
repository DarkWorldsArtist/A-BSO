import { Bank, Items } from 'oldschooljs';
import { describe, expect, test, vi } from 'vitest';

import '@/lib/data/itemAliases.js';

import { QuestID, quests } from '@/lib/minions/data/quests.js';
import { lampCommand } from '@/mahoji/lib/abstracted_commands/lampCommand.js';

const tomeID = 33_715;
const tomeName = 'Tome of experience (The Blood Moon Rises)';

function makeUser(level = 70, quantity = 6) {
	const bank = new Bank().add(tomeID, quantity);
	const removeItemsFromBank = vi.fn(async (cost: Bank) => {
		bank.remove(cost);
	});
	const addXP = vi.fn(async () => 'XP granted.');
	const user = {
		owns: (cost: Bank) => bank.has(cost),
		skillLevel: () => level,
		removeItemsFromBank,
		addXP
	} as unknown as MUser;
	return { user, bank, removeItemsFromBank, addXP };
}

describe('The Blood Moon Rises tome through minion lamp', () => {
	test('awards six named tomes for the quest', () => {
		const quest = quests.find(quest => quest.id === QuestID.TheBloodMoonRises)!;
		expect(quest.rewards!.amount(tomeID)).toBe(6);
		expect(Items.getId(tomeName)).toBe(tomeID);
	});

	test('redeems one tome at level 70 for exactly 30000 XP', async () => {
		const { user, bank, addXP } = makeUser();
		await lampCommand(user, tomeName, 'slayer', undefined);
		expect(bank.amount(tomeID)).toBe(5);
		expect(addXP).toHaveBeenCalledWith({ skillName: 'slayer', amount: 30000, artificial: true });
	});

	test('rejects level 69 without removing items or granting XP', async () => {
		const { user, bank, removeItemsFromBank, addXP } = makeUser(69);
		expect(await lampCommand(user, tomeName, 'slayer', 1)).toContain('level **70**');
		expect(bank.amount(tomeID)).toBe(6);
		expect(removeItemsFromBank).not.toHaveBeenCalled();
		expect(addXP).not.toHaveBeenCalled();
	});

	test('allows six separate choices, but not a seventh redemption', async () => {
		const { user, bank, addXP } = makeUser();
		for (const skill of ['slayer', 'prayer', 'slayer', 'magic', 'crafting', 'herblore']) {
			await lampCommand(user, tomeName, skill, 1);
		}
		expect(bank.amount(tomeID)).toBe(0);
		expect(addXP).toHaveBeenCalledTimes(6);
		for (const call of addXP.mock.calls) expect(call).toEqual([expect.objectContaining({ amount: 30000 })]);
		expect(await lampCommand(user, tomeName, 'slayer', 1)).toContain("You don't have");
		expect(addXP).toHaveBeenCalledTimes(6);
	});

	test('can redeem all six together for 180000 XP', async () => {
		const { user, bank, addXP } = makeUser();
		await lampCommand(user, tomeName, 'slayer', 6);
		expect(bank.amount(tomeID)).toBe(0);
		expect(addXP).toHaveBeenCalledWith({ skillName: 'slayer', amount: 180000, artificial: true });
	});

	test('rejects invalid skills and insufficient quantities without consuming anything', async () => {
		const { user, bank, addXP, removeItemsFromBank } = makeUser();
		expect(await lampCommand(user, tomeName, 'not-a-skill', 1)).toContain('not a valid skill');
		expect(await lampCommand(user, tomeName, 'slayer', 7)).toContain("You don't have");
		expect(bank.amount(tomeID)).toBe(6);
		expect(addXP).not.toHaveBeenCalled();
		expect(removeItemsFromBank).not.toHaveBeenCalled();
	});
});

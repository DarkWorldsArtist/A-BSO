import { Bank } from 'oldschooljs';

import Potions from '@/lib/minions/data/potions.js';
import decantPotionFromBank from '@/lib/minions/functions/decantPotionFromBank.js';

export async function decantCommand(user: MUser, itemName: string, dose = 4) {
	if (![1, 2, 3, 4].includes(dose)) return 'Invalid dose number.';
	if (itemName.trim().toLowerCase() === 'all') {
		const itemsToRemove = new Bank();
		const itemsToAdd = new Bank();
		let potionTypes = 0;

		for (const potion of Potions) {
			if (dose > potion.items.length) continue;

			const result = decantPotionFromBank(user.bank, potion.name, dose);
			if (result.error !== null) continue;
			if (result.potionsToAdd.equals(result.potionsToRemove)) continue;

			itemsToRemove.add(result.potionsToRemove);
			itemsToAdd.add(result.potionsToAdd);
			potionTypes++;
		}

		if (potionTypes === 0) {
			return `You don't have any potions that need decanting into ${dose} doses.`;
		}

		await user.transactItems({
			filterLoot: false,
			itemsToRemove,
			itemsToAdd
		});

		if (user.hasEquipped(['Iron dagger', 'Bronze arrow']) && !user.hasEquippedOrInBank('Clue hunter gloves')) {
			await user.addItemsToBank({
				items: new Bank({ 'Clue hunter gloves': 1 }),
				collectionLog: true
			});
		}

		return `You decanted ${potionTypes} potion types into ${dose}-dose potions. Any leftover doses were kept.`;
	}
	const res = decantPotionFromBank(user.bank, itemName, dose);
	if (res.error !== null) return res.error;
	const { potionsToAdd, sumOfPots, potionName, potionsToRemove } = res;

	if (!user.owns(potionsToRemove)) {
		return `You don't own ${potionsToRemove}.`;
	}

	await user.transactItems({
		filterLoot: false,
		itemsToRemove: potionsToRemove,
		itemsToAdd: potionsToAdd
	});

	if (user.hasEquipped(['Iron dagger', 'Bronze arrow']) && !user.hasEquippedOrInBank('Clue hunter gloves')) {
		await user.addItemsToBank({ items: new Bank({ 'Clue hunter gloves': 1 }), collectionLog: true });
	}

	return `You decanted **${sumOfPots}x ${potionName}${sumOfPots > 0 ? 's' : ''}** into **${potionsToAdd}**.`;
}

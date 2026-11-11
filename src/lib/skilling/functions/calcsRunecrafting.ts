import { Items } from 'oldschooljs';

import { checkDegradeableItemCharges, degradeItem } from '@/lib/degradeableItems.js';
import Runecraft from '@/lib/skilling/skills/runecraft.js';

export async function bloodEssence(rng: RNGProvider, user: MUser, quantity: number): Promise<number> {
	let bonusQuantity = 0;
	const bloodEssenceCharges = await checkDegradeableItemCharges({
		item: Items.getOrThrow('Blood essence (active)'),
		user
	});
	if (bloodEssenceCharges !== null && bloodEssenceCharges > 0) {
		for (let i = 0; i < quantity; i++) {
			if (bonusQuantity === bloodEssenceCharges - 1) {
				break;
			} else if (rng.percentChance(50)) {
				bonusQuantity++;
			}
		}
		if (bonusQuantity > 0) {
			await degradeItem({
				item: Items.getOrThrow('Blood essence (active)'),
				chargesToDegrade: bonusQuantity,
				user
			});
		}
	}
	return bonusQuantity;
}

export function raimentBonus(user: MUser, quantity: number): number {
	let bonusQuantity = 0;
	const hasWardrobe = user.owns('Ancient wardrobe');
	const hasPiece = (id: number) =>
		user.gear.skilling.hasEquipped(id) || (hasWardrobe && user.hasEquippedOrInBank(id));
	const allPieces = Object.keys(Runecraft.raimentsOfTheEyeItems).map(i => Number.parseInt(i));
	const hasAll = allPieces.every(id => hasPiece(id));

	if (hasAll) {
		const amountToAdd = Math.floor(quantity * (60 / 100));
		bonusQuantity = amountToAdd;
	} else {
		for (const [itemID, bonus] of Object.entries(Runecraft.raimentsOfTheEyeItems)) {
			if (hasPiece(Number.parseInt(itemID))) {
				const amountToAdd = Math.floor(quantity * (bonus / 100));
				bonusQuantity += amountToAdd;
			}
		}
	}
	return bonusQuantity;
}

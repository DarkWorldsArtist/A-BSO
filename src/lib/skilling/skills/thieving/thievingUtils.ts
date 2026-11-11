import { ItemGroups } from 'oldschooljs';

export function rogueOutfitPercentBonus(user: MUser): number {
	const skillingSetup = user.gear.skilling;
	const hasWardrobe = user.owns('Ancient wardrobe');
	let amountEquipped = 0;
	for (const id of ItemGroups.rogueOutfit) {
		if (skillingSetup.hasEquipped([id]) || (hasWardrobe && user.hasEquippedOrInBank(id))) {
			amountEquipped++;
		}
	}
	return amountEquipped * 20;
}

import type { GearSetup } from '@oldschoolgg/gear';
import { round } from '@oldschoolgg/toolkit';
import { itemID } from 'oldschooljs';

import { Gear } from '@/lib/structures/Gear.js';

export function calcConBonusXP(_setup: GearSetup | Gear, user?: MUser): number {
	const setup = _setup instanceof Gear ? _setup.raw() : _setup;
	let bonusMultiplier = 0;
	let numberOfItems = 0;
	const hasWardrobe = user?.owns('Ancient wardrobe') ?? false;

	if (
		setup.head?.item === itemID("Carpenter's helmet") ||
		(hasWardrobe && user?.hasEquippedOrInBank("Carpenter's helmet"))
	) {
		bonusMultiplier += 0.4;
		numberOfItems++;
	}

	if (
		setup.body?.item === itemID("Carpenter's shirt") ||
		(hasWardrobe && user?.hasEquippedOrInBank("Carpenter's shirt"))
	) {
		bonusMultiplier += 0.8;
		numberOfItems++;
	}

	if (
		setup.legs?.item === itemID("Carpenter's trousers") ||
		(hasWardrobe && user?.hasEquippedOrInBank("Carpenter's trousers"))
	) {
		bonusMultiplier += 0.6;
		numberOfItems++;
	}

	if (
		setup.feet?.item === itemID("Carpenter's boots") ||
		(hasWardrobe && user?.hasEquippedOrInBank("Carpenter's boots"))
	) {
		bonusMultiplier += 0.2;
		numberOfItems++;
	}

	if (numberOfItems === 4) {
		bonusMultiplier += 0.5;
	}

	return round(bonusMultiplier, 1);
}

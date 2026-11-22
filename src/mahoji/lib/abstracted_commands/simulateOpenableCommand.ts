import { stringMatches } from '@oldschoolgg/toolkit';
import { cryptoRng } from 'node-rng/crypto';
import { Bank, LootTable, toKMB } from 'oldschooljs';

import { PerkTier } from '@/lib/constants.js';
import { marketPriceOfBank } from '@/lib/marketPrices.js';
import { allOpenables, getOpenableLoot } from '@/lib/openables.js';
import { makeBankImage } from '@/lib/util/makeBankImage.js';

export function determineOpenableSimLimit(perkTier: number): number {
	if (perkTier >= PerkTier.Six) return 1_000_000;
	if (perkTier >= PerkTier.Five) return 500_000;
	if (perkTier >= PerkTier.Four) return 250_000;
	if (perkTier >= PerkTier.Three) return 100_000;
	if (perkTier >= PerkTier.Two) return 50_000;
	if (perkTier >= PerkTier.One) return 25_000;
	return 10_000;
}

export async function simulateOpenableCommand(user: MUser, itemName: string, quantity = 100) {
	const openable = allOpenables.find(
		i => stringMatches(i.name, itemName) || i.aliases.some(a => stringMatches(a, itemName))
	);
	if (!openable) {
		return 'That is not a valid openable item.';
	}

	const perkTier = await user.fetchPerkTier();
	const maxLimit = determineOpenableSimLimit(perkTier);
	const effectiveLimit = openable.output instanceof LootTable ? maxLimit : Math.min(maxLimit, 10_000);

	if (quantity < 1 || quantity > effectiveLimit) {
		return `You can simulate opening between 1 and ${effectiveLimit.toLocaleString()} ${openable.name} at your patron tier.`;
	}

	const result = await getOpenableLoot({
		openable,
		quantity,
		user,
		totalLeaguesPoints: 0,
		rng: cryptoRng
	});

	const loot = new Bank(result.bank);
	const gpValue = loot.value();
	const mvValue = marketPriceOfBank(loot);

	const image = await makeBankImage({
		bank: loot,
		title: `Simulated ${quantity.toLocaleString()}x ${openable.name}`,
		user
	});

	return {
		content: `Simulated opening ${quantity.toLocaleString()}x **${openable.name}** (Value: ${toKMB(gpValue)}, MV: ${toKMB(mvValue)}).`,
		files: [image]
	};
}

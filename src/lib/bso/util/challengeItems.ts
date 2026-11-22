import { randArrItem } from 'node-rng';
import { type Item, Items } from 'oldschooljs';

import { OSRSCanvas } from '@/lib/canvas/OSRSCanvas.js';
import { allCLItems } from '@/lib/data/Collections.js';

let cachedChallengeItems: Item[] | null = null;

const VALID_CHALLENGE_NAME_REGEX = /^[A-Za-z' -]{4,24}$/;
const EXCLUDED_SUBSTRINGS = ['null', 'placeholder', 'test', 'unused', 'debug', 'unobtainable', 'set', 'pack'];

export function getRecognizableChallengeItems(): Item[] {
	if (cachedChallengeItems && cachedChallengeItems.length > 0) {
		return cachedChallengeItems;
	}

	const pool: Item[] = [];
	const seenNames = new Set<string>();

	for (const item of Items.values()) {
		if (!item || !item.name) continue;
		if (item.customItemData?.isSecret) continue;
		if (!VALID_CHALLENGE_NAME_REGEX.test(item.name)) continue;

		const lower = item.name.toLowerCase();
		if (EXCLUDED_SUBSTRINGS.some(sub => lower.includes(sub))) continue;

		const isRecognizable = allCLItems.has(item.id) || (Boolean(item.tradeable_on_ge) && (item.price ?? 0) >= 5_000);
		if (!isRecognizable) continue;

		if (seenNames.has(lower)) continue;
		seenNames.add(lower);
		pool.push(item);
	}

	cachedChallengeItems = pool;
	return pool;
}

export function pickRandomChallengeItems(count: number, requireSprite = false): Item[] {
	const pool = getRecognizableChallengeItems();
	const filtered = requireSprite ? pool.filter(i => Boolean(OSRSCanvas.getItemSpriteData(i.id))) : pool;
	const source = filtered.length >= count ? filtered : pool;

	const chosen: Item[] = [];
	const chosenIds = new Set<number>();
	let attempts = 0;
	while (chosen.length < count && attempts < count * 20) {
		attempts++;
		const candidate = randArrItem(source);
		if (!candidate || chosenIds.has(candidate.id)) continue;
		chosenIds.add(candidate.id);
		chosen.push(candidate);
	}
	return chosen;
}

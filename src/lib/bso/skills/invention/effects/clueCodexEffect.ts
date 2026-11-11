import { InventionID } from '@/lib/bso/skills/invention/inventions.js';

import { sumArr } from '@oldschoolgg/toolkit';
import { MathRNG } from 'node-rng';
import { Bank } from 'oldschooljs';

import { ClueTiers } from '@/lib/clues/clueTiers.js';
import { GearBank } from '@/lib/structures/GearBank.js';
import type { UpdateBank } from '@/lib/structures/UpdateBank.js';

export const clueCodexChances: Record<number, number> = {
	0: 40,
	1: 35,
	2: 30,
	3: 25,
	4: 20,
	5: 10
};

export function applyClueCodexToLoot({
	user,
	loot,
	rng = MathRNG,
	messages
}: {
	user: MUser | GearBank | number;
	loot: Bank;
	rng?: RNGProvider;
	messages?: string[];
}): { upgradedClues: Bank; message: string } | null {
	if (typeof user === 'number') return null;

	const hasCodex =
		user instanceof GearBank
			? user.bank.has('Clue codex')
			: user.allItemsOwned.has('Clue codex') && !user.user.disabled_inventions.includes(InventionID.ClueCodex);

	if (!hasCodex) return null;

	const upgradedClues = new Bank();
	const removeBank = new Bank();

	for (let i = 0; i < 6; i++) {
		const clueTier = ClueTiers[i];
		const upgradeChance = clueCodexChances[i];
		if (!upgradeChance || !loot.has(clueTier.scrollID)) continue;
		for (let t = 0; t < loot.amount(clueTier.scrollID); t++) {
			if (rng.percentChance(upgradeChance)) {
				removeBank.add(clueTier.scrollID);
				upgradedClues.add(ClueTiers[i + 1].scrollID);
			}
		}
	}

	if (upgradedClues.length === 0) return null;

	loot.remove(removeBank);
	loot.add(upgradedClues);

	const totalCluesUpgraded = sumArr(upgradedClues.items().map(i => i[1]));
	const msg = `Upgraded ${totalCluesUpgraded} clues via Clue codex`;
	if (messages) messages.push(msg);

	return { upgradedClues, message: msg };
}

export function clueCodexEffect({
	gearBank,
	messages,
	disabledInventions,
	updateBank
}: {
	disabledInventions: number[];
	gearBank: GearBank;
	updateBank: UpdateBank;
	messages: string[];
}) {
	if (!gearBank.bank.has('Clue codex') || disabledInventions.includes(InventionID.ClueCodex)) return false;

	const res = applyClueCodexToLoot({
		user: gearBank,
		loot: updateBank.itemLootBank,
		rng: MathRNG,
		messages
	});

	if (!res) return false;

	updateBank.clientStatsBankUpdates.clue_upgrader_loot = res.upgradedClues;
	updateBank.userStatsBankUpdates.clue_upgrader_bank = res.upgradedClues;
	return true;
}

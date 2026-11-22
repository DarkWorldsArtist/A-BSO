import type { ItemBank } from 'oldschooljs';
import { Bank, itemID } from 'oldschooljs';

export const BURIED_FIRMAMENT_ID = 75_073;

const REQUIRED_CL_ITEMS = [
	itemID('Elder sigil'),
	itemID('Elderflame bow'),
	itemID('Empyrean greathelm'),
	itemID('Vitrolic curse'),
	itemID('Dragonbane aegis'),
	itemID('Dragonbane glaive'),
	itemID('Celestial pendant'),
	itemID('Prismare ring'),
	itemID('Searcrown band')
] as const;

const REQUIRED_BOSS_IDS_100 = [142_001, 142_002, 142_003, 142_004, 142_006] as const;

const ELDER_MIMIC_ID = 142_005;
const ELDER_MIMIC_MIN_KC = 10;
const BOSS_MIN_KC = 100;

const REQUIRED_OPENS: [number, number][] = [
	[75_022, 50],
	[75_023, 50],
	[75_024, 50],
	[75_043, 1]
];

const REQUIRED_MINIGAMES: [string, number][] = [
	['construction_contracts', 100],
	['brimstone_distillery', 100]
];

const REQUIRED_ISLAND_TIERS = [
	'boss',
	'megaboss',
	'minigame',
	'gathering',
	'prismare',
	'fishing',
	'mining',
	'woodcutting',
	'divination',
	'farming'
] as const;

export function grantBuriedFirmamentBank(): Bank {
	return new Bank().add(BURIED_FIRMAMENT_ID, 1);
}

export function userOwnsOrEquipsBuriedFirmament(user: MUser): boolean {
	if (user.bank.has(BURIED_FIRMAMENT_ID)) return true;
	for (const setup of Object.values(user.gear)) {
		for (const slot of Object.values(setup.raw())) {
			if (slot?.item === BURIED_FIRMAMENT_ID) return true;
		}
	}
	return false;
}

export function hasEarnedBuriedFirmament(user: MUser): boolean {
	return user.cl.has(BURIED_FIRMAMENT_ID);
}

export function checkBuriedFirmamentCriteria(args: {
	cl: Bank;
	monsterScores: ItemBank;
	activityCounts: Record<string, number>;
	opens: Bank;
	upgrades: Record<(typeof REQUIRED_ISLAND_TIERS)[number], number>;
	minigameScores: Record<string, number>;
}): boolean {
	const { cl, monsterScores, minigameScores, opens, upgrades } = args;

	if (REQUIRED_ISLAND_TIERS.some(k => (upgrades[k] ?? 0) < 5)) return false;
	if (REQUIRED_CL_ITEMS.some(id => !cl.has(id))) return false;
	if (REQUIRED_BOSS_IDS_100.some(id => ((monsterScores[id] ?? 0) as number) < BOSS_MIN_KC)) return false;
	if (((monsterScores[ELDER_MIMIC_ID] ?? 0) as number) < ELDER_MIMIC_MIN_KC) return false;
	if (REQUIRED_OPENS.some(([id, min]) => opens.amount(id) < min)) return false;
	if (REQUIRED_MINIGAMES.some(([id, min]) => (minigameScores[id] ?? 0) < min)) return false;

	return true;
}

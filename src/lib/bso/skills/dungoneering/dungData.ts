import { Items } from 'oldschooljs';

export type Floor = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export const allFloors: Floor[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function isValidFloor(floor: number | string): floor is Floor {
	return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(floor as number);
}

export const dungBuyables = [
	{
		item: Items.getOrThrow('Chaotic rapier'),
		cost: 200_000
	},
	{
		item: Items.getOrThrow('Chaotic longsword'),
		cost: 200_000
	},
	{
		item: Items.getOrThrow('Chaotic maul'),
		cost: 200_000
	},
	{
		item: Items.getOrThrow('Chaotic staff'),
		cost: 200_000
	},
	{
		item: Items.getOrThrow('Chaotic crossbow'),
		cost: 200_000
	},
	{
		item: Items.getOrThrow('Offhand Chaotic rapier'),
		cost: 100_000
	},
	{
		item: Items.getOrThrow('Offhand Chaotic longsword'),
		cost: 100_000
	},
	{
		item: Items.getOrThrow('Offhand Chaotic crossbow'),
		cost: 100_000
	},
	{
		item: Items.getOrThrow('Farseer kiteshield'),
		cost: 200_000
	},
	{
		item: Items.getOrThrow('Scroll of life'),
		cost: 400_000
	},
	{
		item: Items.getOrThrow('Herbicide'),
		cost: 400_000
	},
	{
		item: Items.getOrThrow('Scroll of efficiency'),
		cost: 400_000
	},
	{
		item: Items.getOrThrow('Scroll of farming'),
		cost: 400_000
	},
	{
		item: Items.getOrThrow('Scroll of cleansing'),
		cost: 400_000
	},
	{
		item: Items.getOrThrow('Scroll of dexterity'),
		cost: 400_000
	},
	{
		item: Items.getOrThrow('Scroll of teleportation'),
		cost: 400_000
	},
	{
		item: Items.getOrThrow('Scroll of mystery'),
		cost: 500_000
	},
	{
		item: Items.getOrThrow('Amulet of zealots'),
		cost: 400_000
	},
	{
		item: Items.getOrThrow('Scroll of proficiency'),
		cost: 900_000
	},
	{
		item: Items.getOrThrow('Frostbite'),
		cost: 2_000_000
	},
	{
		item: Items.getOrThrow('Chaotic remnant'),
		cost: 500_000
	},
	{
		item: Items.getOrThrow('Scroll of longevity'),
		cost: 800_000
	},
	{
		item: Items.getOrThrow('Scroll of the hunt'),
		cost: 800_000
	},
	{
		item: Items.getOrThrow('Daemonheim agility pass'),
		cost: 1_000_000
	},
	{
		item: Items.getOrThrow('Dungeoneering dye'),
		cost: 4_000_000
	},
	{
		item: Items.getOrThrow('Ring of kinship (tier 1)'),
		cost: 1000
	},
	{
		item: Items.getOrThrow('Kinship overcharger'),
		cost: 500_000
	},
	{
		item: Items.getOrThrow("Smuggler's lockpick"),
		cost: 500_000
	},
	{
		item: Items.getOrThrow('Scroll of the salvager'),
		cost: 400_000
	},
	{
		item: Items.getOrThrow('Daemonheim resource cache'),
		cost: 50_000
	},
	{
		item: Items.getOrThrow('Clue codex'),
		cost: 2_500_000
	}
];

export const floorDgLevels: Record<number, number> = {
	1: 1,
	2: 15,
	3: 30,
	4: 45,
	5: 60,
	6: 75,
	7: 90,
	8: 100,
	9: 110,
	10: 118
};

export const floorCombatLevels: Record<number, number> = {
	1: 10,
	2: 20,
	3: 35,
	4: 50,
	5: 65,
	6: 75,
	7: 85,
	8: 95,
	9: 105,
	10: 115
};

export const floorNonCombatLevels: Record<number, number> = {
	1: 5,
	2: 10,
	3: 20,
	4: 30,
	5: 40,
	6: 50,
	7: 60,
	8: 70,
	9: 80,
	10: 90
};

export function determineDgLevelForFloor(floor: number) {
	return floorDgLevels[floor] ?? 1;
}

export function requiredLevel(floor: number) {
	return floorCombatLevels[floor] ?? 10;
}

export function requiredSkills(floor: number) {
	const lvl = requiredLevel(floor);
	const nonCmbLvl = floorNonCombatLevels[floor] ?? 5;
	return {
		attack: lvl,
		strength: lvl,
		defence: lvl,
		hitpoints: lvl,
		magic: lvl,
		ranged: lvl,
		herblore: nonCmbLvl,
		runecraft: nonCmbLvl,
		prayer: nonCmbLvl,
		fletching: nonCmbLvl,
		fishing: nonCmbLvl,
		cooking: nonCmbLvl,
		construction: nonCmbLvl,
		crafting: nonCmbLvl,
		dungeoneering: determineDgLevelForFloor(floor)
	};
}

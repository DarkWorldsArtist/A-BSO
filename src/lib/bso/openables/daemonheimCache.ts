import { getDungeoneeringFloorCount } from '@/lib/bso/skills/dungoneering/dungDbFunctions.js';

import { Bank, Items, itemID, resolveItems } from 'oldschooljs';

import type { UnifiedOpenable } from '@/lib/openables.js';
import type { Skills } from '@/lib/types/index.js';

type CacheDrop = [item: string, min: number, max: number];
interface CacheCategory {
	skills: (keyof Skills)[];
	tiers: [minLevel: number, drops: CacheDrop[]][];
	rare?: [minLevel: number, chance: number, drop: CacheDrop];
}

const cacheCategories: Record<string, CacheCategory> = {
	mining: {
		skills: ['mining'],
		rare: [120, 250, ['Dwarven ore', 1, 1]],
		tiers: [
			[
				95,
				[
					['Dark animica', 15, 30],
					['Solite', 15, 30],
					['Runite ore', 15, 35],
					['Adamantite ore', 25, 50],
					['Runite stone spirit', 20, 45],
					['Coal', 100, 250]
				]
			],
			[
				80,
				[
					['Runite ore', 10, 25],
					['Adamantite ore', 20, 45],
					['Mithril ore', 30, 60],
					['Gold ore', 30, 60],
					['Adamantite stone spirit', 25, 50],
					['Coal', 80, 180]
				]
			],
			[
				60,
				[
					['Adamantite ore', 15, 30],
					['Mithril ore', 25, 50],
					['Gold ore', 20, 40],
					['Mithril stone spirit', 25, 50],
					['Coal', 50, 120]
				]
			],
			[
				1,
				[
					['Iron ore', 30, 60],
					['Coal', 30, 70],
					['Gold ore', 15, 30],
					['Iron stone spirit', 30, 60]
				]
			]
		]
	},
	smithing: {
		skills: ['smithing'],
		tiers: [
			[
				95,
				[
					['Runite bar', 15, 30],
					['Adamantite bar', 25, 50],
					['Gold bar', 30, 60]
				]
			],
			[
				80,
				[
					['Runite bar', 10, 20],
					['Adamantite bar', 20, 40],
					['Mithril bar', 30, 60],
					['Gold bar', 25, 50]
				]
			],
			[
				60,
				[
					['Adamantite bar', 12, 25],
					['Mithril bar', 20, 45],
					['Steel bar', 30, 60],
					['Silver bar', 25, 50]
				]
			],
			[
				1,
				[
					['Steel bar', 20, 40],
					['Iron bar', 25, 50],
					['Silver bar', 20, 40]
				]
			]
		]
	},
	farming: {
		skills: ['farming'],
		tiers: [
			[
				95,
				[
					['Athelas seed', 1, 2],
					['Korulsi seed', 1, 2],
					['Advax berry seed', 1, 2],
					['Mango seed', 1, 2],
					['Avocado seed', 1, 2],
					['Redwood tree seed', 1, 1],
					['Celastrus seed', 1, 1],
					['Dragonfruit tree seed', 1, 2],
					['Mango', 10, 25],
					['Avocado', 10, 25]
				]
			],
			[
				80,
				[
					['Spirit weed seed', 1, 3],
					['Torstol seed', 1, 3],
					['Snapdragon seed', 1, 3],
					['Magic seed', 1, 2],
					['Palm tree seed', 1, 2],
					['Yew seed', 1, 2],
					['Mysterious seed', 1, 2],
					['Snape grass seed', 3, 8]
				]
			],
			[
				60,
				[
					['Ranarr seed', 2, 4],
					['Toadflax seed', 3, 6],
					['Yew seed', 1, 2],
					['Snape grass', 20, 50]
				]
			],
			[
				1,
				[
					['Ranarr seed', 1, 3],
					['Toadflax seed', 2, 5],
					['Watermelon', 15, 30]
				]
			]
		]
	},
	herblore: {
		skills: ['herblore'],
		tiers: [
			[
				95,
				[
					['Athelas', 15, 30],
					['Korulsi', 15, 30],
					['Grimy korulsi', 15, 30],
					['Grimy torstol', 20, 40],
					['Crushed nest', 20, 40],
					["Red spiders' eggs", 25, 50]
				]
			],
			[
				85,
				[
					['Grimy torstol', 15, 35],
					['Grimy snapdragon', 20, 40],
					['Spirit weed', 20, 40],
					['Advax berry', 20, 40],
					['Grimy cadantine', 20, 40],
					['Dragon scale dust', 25, 50]
				]
			],
			[
				70,
				[
					['Grimy snapdragon', 15, 30],
					['Grimy ranarr weed', 20, 40],
					['Grimy toadflax', 20, 45],
					['Grimy kwuarm', 20, 45],
					['Wine of zamorak', 20, 45]
				]
			],
			[
				1,
				[
					['Grimy ranarr weed', 10, 25],
					['Grimy avantoe', 15, 30],
					['Mort myre fungus', 20, 40]
				]
			]
		]
	},
	potions: {
		skills: ['herblore'],
		tiers: [
			[
				95,
				[
					['Enhanced saradomin brew', 3, 8],
					['Enhanced super restore', 3, 8],
					['Enhanced stamina potion', 3, 8],
					['Brimstone elixir', 2, 5],
					['Divination potion', 3, 8],
					['Super combat potion(4)', 4, 10],
					['Extended super antifire(4)', 4, 10]
				]
			],
			[
				80,
				[
					['Enhanced saradomin brew', 2, 6],
					['Enhanced super restore', 2, 6],
					['Super combat potion(4)', 3, 8],
					['Saradomin brew(4)', 4, 10],
					['Super restore(4)', 4, 10],
					['Stamina potion(4)', 4, 10],
					['Extended antifire(4)', 4, 10]
				]
			],
			[
				60,
				[
					['Super restore(4)', 3, 8],
					['Saradomin brew(4)', 3, 8],
					['Ranging potion(4)', 4, 10],
					['Magic potion(4)', 4, 10],
					['Prayer potion(4)', 5, 12]
				]
			],
			[1, [['Prayer potion(4)', 4, 10]]]
		]
	},
	divination: {
		skills: ['divination'],
		tiers: [
			[
				95,
				[
					['Ancient energy', 100, 250],
					['Elder energy', 150, 300]
				]
			],
			[
				80,
				[
					['Elder energy', 100, 200],
					['Incandescent energy', 200, 400]
				]
			],
			[60, [['Luminous energy', 200, 400]]],
			[1, [['Radiant energy', 100, 250]]]
		]
	},
	portents: {
		skills: ['divination'],
		tiers: [
			[
				95,
				[
					['Dungeon portent', 1, 3],
					['Cache portent', 1, 3],
					['Lucky portent', 1, 3],
					['Rebirth portent', 1, 3]
				]
			],
			[
				80,
				[
					['Spiritual mining portent', 2, 5],
					['Pacifist hunting portent', 2, 5],
					['Rogues portent', 2, 5]
				]
			],
			[1, [['Graceful portent', 2, 6]]]
		]
	},
	construction: {
		skills: ['construction', 'woodcutting'],
		tiers: [
			[
				95,
				[
					['Elder logs', 30, 70],
					['Mahogany logs', 50, 100]
				]
			],
			[
				80,
				[
					['Elder logs', 20, 40],
					['Mahogany logs', 40, 80],
					['Teak logs', 50, 100]
				]
			],
			[
				60,
				[
					['Mahogany logs', 30, 60],
					['Teak logs', 40, 80],
					['Oak logs', 50, 100]
				]
			],
			[
				1,
				[
					['Teak logs', 25, 50],
					['Oak logs', 30, 60],
					['Logs', 40, 80]
				]
			]
		]
	},
	fishing: {
		skills: ['fishing', 'cooking'],
		tiers: [
			[
				95,
				[
					['Raw rocktail', 25, 50],
					['Raw anglerfish', 30, 60],
					['Raw dark crab', 30, 60],
					['Raw manta ray', 30, 60]
				]
			],
			[
				80,
				[
					['Raw shark', 30, 60],
					['Raw sea turtle', 30, 60],
					['Raw monkfish', 40, 80]
				]
			],
			[
				60,
				[
					['Raw karambwan', 35, 70],
					['Raw swordfish', 40, 80],
					['Raw lobster', 40, 80]
				]
			],
			[
				1,
				[
					['Raw tuna', 30, 60],
					['Raw lobster', 25, 50]
				]
			]
		]
	},
	runecraft: {
		skills: ['runecraft'],
		tiers: [
			[
				95,
				[
					['Elder rune', 100, 250],
					['Wrath rune', 150, 300],
					['Tainted essence chunk', 15, 30],
					['Blood rune', 250, 500],
					['Soul rune', 250, 500]
				]
			],
			[
				80,
				[
					['Blood rune', 200, 400],
					['Soul rune', 200, 400],
					['Death rune', 250, 500],
					['Nature rune', 250, 500],
					['Law rune', 250, 500]
				]
			],
			[
				60,
				[
					['Death rune', 200, 400],
					['Chaos rune', 250, 500],
					['Nature rune', 200, 400],
					['Law rune', 200, 400],
					['Pure essence', 1000, 2500]
				]
			],
			[
				1,
				[
					['Chaos rune', 150, 300],
					['Nature rune', 100, 200],
					['Pure essence', 500, 1500]
				]
			]
		]
	},
	hunter: {
		skills: ['hunter'],
		tiers: [
			[
				95,
				[
					['Mystery impling jar', 1, 1],
					['Eternal impling jar', 1, 1],
					['Infernal impling jar', 1, 2],
					['Dragon impling jar', 1, 2],
					['Lucky impling jar', 1, 1],
					['Magpie impling jar', 2, 4],
					['Ninja impling jar', 2, 4]
				]
			],
			[
				80,
				[
					['Dragon impling jar', 1, 1],
					['Magpie impling jar', 1, 3],
					['Ninja impling jar', 1, 3],
					['Nature impling jar', 2, 5],
					['Eclectic impling jar', 3, 6],
					['Infernal impling jar', 1, 1]
				]
			],
			[
				60,
				[
					['Ninja impling jar', 1, 2],
					['Nature impling jar', 2, 4],
					['Eclectic impling jar', 2, 5],
					['Essence impling jar', 3, 6],
					['Earth impling jar', 3, 6]
				]
			],
			[
				1,
				[
					['Gourmet impling jar', 2, 4],
					['Young impling jar', 2, 5],
					['Baby impling jar', 3, 6],
					['Earth impling jar', 2, 5]
				]
			]
		]
	},
	prayer: {
		skills: ['prayer'],
		tiers: [
			[
				95,
				[
					['Frost dragon bones', 10, 25],
					['Superior dragon bones', 15, 30],
					['Ourg bones', 15, 30],
					['Hydra bones', 15, 30]
				]
			],
			[
				80,
				[
					['Superior dragon bones', 10, 20],
					['Dagannoth bones', 15, 30],
					['Lava dragon bones', 15, 30],
					['Drake bones', 15, 30],
					['Wyvern bones', 20, 40]
				]
			],
			[
				60,
				[
					['Dagannoth bones', 12, 25],
					['Dragon bones', 20, 40],
					['Wyvern bones', 15, 30],
					['Babydragon bones', 25, 50]
				]
			],
			[
				1,
				[
					['Dragon bones', 10, 20],
					['Babydragon bones', 15, 30],
					['Big bones', 30, 60]
				]
			]
		]
	},
	crafting: {
		skills: ['crafting'],
		tiers: [
			[
				95,
				[
					['Royal dragonhide', 15, 35],
					['Ganodermic flake', 30, 80],
					['Black dragonhide', 20, 40],
					['Uncut dragonstone', 3, 8],
					['Onyx bolt tips', 10, 25]
				]
			],
			[
				80,
				[
					['Black dragonhide', 15, 30],
					['Grifolic flake', 30, 70],
					['Red dragonhide', 20, 40],
					['Battlestaff', 15, 35],
					['Uncut diamond', 10, 25]
				]
			],
			[
				60,
				[
					['Red dragonhide', 15, 30],
					['Blue dragonhide', 20, 40],
					['Molten glass', 50, 120],
					['Uncut ruby', 15, 35]
				]
			],
			[
				1,
				[
					['Green dragonhide', 20, 40],
					['Molten glass', 30, 70]
				]
			]
		]
	},
	fletching: {
		skills: ['fletching'],
		tiers: [
			[
				95,
				[
					['Royal bolts', 50, 150],
					['Dragon bolts (unf)', 30, 80],
					['Dragon dart tip', 30, 80],
					['Dragon arrowtips', 30, 80],
					['Magic logs', 30, 70],
					['Amethyst arrowtips', 40, 100]
				]
			],
			[
				80,
				[
					['Diamond bolts (e)', 40, 100],
					['Ruby bolts (e)', 40, 100],
					['Magic logs', 20, 50],
					['Rune arrowtips', 50, 120],
					['Bow string', 50, 120]
				]
			],
			[
				60,
				[
					['Broad bolts', 100, 250],
					['Yew logs', 40, 90],
					['Rune arrowtips', 30, 80],
					['Bow string', 40, 90]
				]
			],
			[
				1,
				[
					['Maple logs', 50, 100],
					['Bow string', 30, 70]
				]
			]
		]
	}
};

const cacheShopBuyables = resolveItems([
	'Scroll of life',
	'Scroll of efficiency',
	'Scroll of farming',
	'Scroll of cleansing',
	'Scroll of dexterity',
	'Scroll of teleportation',
	'Scroll of mystery',
	'Scroll of proficiency',
	'Scroll of longevity',
	'Scroll of the hunt',
	'Scroll of the salvager',
	'Herbicide',
	'Amulet of zealots',
	"Smuggler's lockpick"
]);

const unscaledItems = new Set([
	'Mystery impling jar',
	'Eternal impling jar',
	'Lucky impling jar',
	'Redwood tree seed',
	'Celastrus seed'
]);

export const daemonheimCacheOpenable: UnifiedOpenable = {
	name: 'Daemonheim resource cache',
	id: itemID('Daemonheim resource cache'),
	openedItem: Items.getOrThrow('Daemonheim resource cache'),
	aliases: ['daemonheim resource cache', 'resource cache', 'dg cache'],
	output: async ({ user, quantity, rng }) => {
		const loot = new Bank();
		const dgLevel = user.skillsAsLevels.dungeoneering ?? 1;
		const totalProgression = Math.min(1.0, user.totalLevel / 2500);
		const floorCompletions = await getDungeoneeringFloorCount(user);
		const floorBonus = Math.min(0.4, (floorCompletions / 250) * 0.4);
		const baseMultiplier = 1.0 + (dgLevel / 120) * 0.4 + totalProgression * 0.4 + floorBonus;
		const categoryNames = Object.keys(cacheCategories);

		for (let i = 0; i < quantity; i++) {
			const picked = rng.shuffle([...categoryNames]).slice(0, rng.randInt(4, 6));
			for (const catName of picked) {
				const cat = cacheCategories[catName];
				const effLvl = Math.max(...cat.skills.map(s => user.skillsAsLevels[s] ?? 1));
				const skillMult = baseMultiplier * (1.0 + (effLvl / 120) * 0.4);

				if (cat.rare && effLvl >= cat.rare[0] && rng.roll(cat.rare[1])) {
					const [rareItem, rareMin, rareMax] = cat.rare[2];
					const rareQty =
						rareItem === 'Dwarven ore'
							? 1
							: Math.max(1, Math.floor(rng.randInt(rareMin, rareMax) * skillMult));
					loot.add(rareItem, rareQty);
				}

				const tier = cat.tiers.find(t => effLvl >= t[0]) ?? cat.tiers[cat.tiers.length - 1];
				const [item, min, max] = rng.pick(tier[1]);
				let qty = rng.randInt(min, max);
				if (!unscaledItems.has(item)) {
					if (item.endsWith('seed')) {
						qty = Math.min(3, Math.max(1, Math.floor(qty * Math.min(1.5, skillMult))));
					} else {
						qty = Math.max(1, Math.floor(qty * skillMult));
					}
				}
				loot.add(item, qty);
			}

			if (rng.roll(150)) {
				const unownedShopItems = cacheShopBuyables.filter(id => !user.owns(id) && !loot.has(id));
				if (unownedShopItems.length > 0) {
					const awarded = rng.pick(unownedShopItems);
					loot.add(awarded, 1);
				}
			}
		}

		return { bank: loot };
	},
	allItems: resolveItems([
		...new Set([
			...Object.values(cacheCategories).flatMap(cat => [
				...cat.tiers.flatMap(t => t[1].map(d => d[0])),
				...(cat.rare ? [cat.rare[2][0]] : [])
			]),
			...cacheShopBuyables
		])
	])
};

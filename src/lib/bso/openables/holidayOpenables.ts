import {
	BeachMysteryBoxTable,
	IndependenceBoxTable,
	RoyalMysteryBoxTable,
	spookyTable
} from '@/lib/bso/openables/tables.js';

import { Items, itemID, LootTable } from 'oldschooljs';

import type { UnifiedOpenable } from '@/lib/openables.js';

const christmasPetFoodTable = new LootTable()
	.add('Pumpkinhead praline')
	.add('Takon truffle')
	.add('Seer sweet')
	.add('Cob cup')
	.add('Craig creme')
	.add('Moktang mint')
	.add('Festive treats')
	.add('Pork sausage')
	.add('Pork crackling')
	.add('Reinbeer');

const christmasLootTable = new LootTable()
	.tertiary(18, 'Christmas box')
	.add(
		new LootTable()
			.add('Festive jumper (2022)', 1, 2)
			.add('Christmas cape', 1, 2)
			.add('Christmas socks', 1, 2)
			.add('Tinsel scarf', 1, 4)
			.add('Frosted wreath', 1, 4)
			.add('Edible yoyo', 1, 4)
			.add(christmasPetFoodTable, 1, 5)
	)
	.add(christmasPetFoodTable, 1, 4)
	.add(
		new LootTable()
			.add('Pavlova')
			.add('Prawns')
			.add('Roast potatoes')
			.add('Cake')
			.add('Chocolate cake')
			.add('Chocolate bar')
			.add('Bucket of milk')
			.add('Chocchip crunchies'),
		1,
		4
	);

const ChristmasBoxTable = new LootTable()
	.add('Candy partyhat')
	.add(christmasLootTable, 1, 4)
	.add('Christmas dye', 1, 3)
	.add('Coal', 1, 2);

const HalloweenCrackerTable = new LootTable()
	.add('Zombie halloween mask')
	.add('Bloody halloween mask')
	.add('Monster in a backpack')
	.add('Pumpkin parasol')
	.add('Vampyric halloween mask')
	.add('Zombie cow plushie')
	.add('Deathtouched tart')
	.add('Pumpkin-ish box');

export const discontinuedHalloweenCommonsTable = new LootTable()
	.add('Human appendage', [1, 3])
	.add('Sliced femur', [1, 3])
	.add('Human blood', [1, 5])
	.add('Human tooth', [1, 5])
	.add('Candy teeth', [1, 5])
	.add('Toffeet', [1, 5])
	.add('Chocolified skull', [1, 3])
	.add('Rotten sweets', [1, 5])
	.add('Hairyfloss', [1, 5])
	.add('Eyescream', [1, 3])
	.add('Goblinfinger soup', [1, 3])
	.add("Benny's brain brew", [1, 3])
	.add('Roasted newt', [1, 3])
	.add("Choc'rock", [1, 5])
	.add('Pumpkin seed', [1, 5])
	.add('Gloom and doom potion', [1, 3])
	.add('Handled candle', [1, 3])
	.add('Halloween candy', [1, 5])
	.add('Deathtouched tart', [1, 3]);

export const discontinuedHalloweenUniquesTable = new LootTable()
	.add('Dirty hoe')
	.add('Boo-balloon')
	.add('Twinkly topper')
	.add('Broomstick')
	.add('Spooky graceful hood')
	.add('Spooky graceful top')
	.add('Spooky graceful legs')
	.add('Spooky graceful cape')
	.add('Spooky graceful boots')
	.add('Spooky graceful gloves')
	.add('Necronomicon')
	.add("M'eye hat")
	.add('Back pain')
	.add('Witch hat')
	.add('Spooky mask')
	.add('Grim sweeper')
	.add('Splooky fwizzle')
	.add("Fool's ace")
	.add('Bag of tricks')
	.add('Bat bat')
	.add('Spookling token')
	.add('Heirloom pumpkin')
	.add('Mumpkin')
	.add('Jack-o-lantern')
	.add('Haunted cloak')
	.add("Pumpkinhead's headbringer")
	.add('Haunted amulet')
	.add('Haunted gloves')
	.add('Haunted boots')
	.add("Pumpkinhead's pumpkin head")
	.add('Witch card')
	.add('Ghost card')
	.add('Vampire card')
	.add('Death card')
	.add('Pumpkinman card');

export const discontinuedHalloweenRaresTable = new LootTable()
	.add('Spooky partyhat')
	.add('Orange halloween mask')
	.add('Purple halloween mask')
	.add('Zombie halloween mask')
	.add('Bloody halloween mask')
	.add('Vampyric halloween mask')
	.add('Evil partyhat')
	.add('Soul shield')
	.add("Pandora's box")
	.add('Maledict codex')
	.add('Maledict hat')
	.add('Maledict top')
	.add('Maledict legs')
	.add('Maledict boots')
	.add('Maledict cape')
	.add('Maledict gloves')
	.add('Maledict ring')
	.add('Maledict amulet')
	.add('Cosmic dice')
	.add('Spooky aura')
	.add('Spooky sheet')
	.add('Covenant of grimace')
	.add('Casper')
	.add('Kuro')
	.add('Gregoyle')
	.add('Polterpup')
	.add('Miniature pumpkin head')
	.add('Mini mortimer')
	.add('Mini Pumpkinhead')
	.add('Night-Mare')
	.add('Zombie cow plushie')
	.add('Monster in a backpack')
	.add('Pumpkin parasol');

export const PumpkinIshBoxTable = new LootTable()
	.tertiary(7500, 'Cob')
	.tertiary(5, 'Pumpkin-ish seeds')
	.add('Rotten pumpkin', [1, 2], 5)
	.add('Greased pumpkin', 1, 5)
	.add('Alluring pumpkin', 1, 4)
	.add('Scared-crow', 1, 1)
	.add('Spooky box', 1, 4)
	.add('Halloween cracker', 1, 2)
	.add('Coins', [5_000_000, 50_000_000], 5)
	.add(discontinuedHalloweenCommonsTable, 1, 10)
	.add(discontinuedHalloweenUniquesTable, 1, 3)
	.add(discontinuedHalloweenRaresTable, 1, 1);

export const holidayOpenables: UnifiedOpenable[] = [
	{
		name: 'Pumpkin-ish box',
		id: itemID('Pumpkin-ish box'),
		openedItem: Items.getOrThrow('Pumpkin-ish box'),
		aliases: ['pumpkin-ish box', 'pumpkin box', 'pumpkinish box'],
		output: async ({ quantity }) => ({
			bank: PumpkinIshBoxTable.roll(quantity * 3)
		}),
		allItems: PumpkinIshBoxTable.allItems,
		excludeFromOpenAll: true
	},
	{
		name: 'Royal mystery box',
		id: itemID('Royal mystery box'),
		openedItem: Items.getOrThrow('Royal mystery box'),
		aliases: ['royal mystery box'],
		output: RoyalMysteryBoxTable,
		allItems: RoyalMysteryBoxTable.allItems,
		excludeFromOpenAll: true
	},
	{
		name: 'Beach mystery box',
		id: itemID('Beach mystery box'),
		openedItem: Items.getOrThrow('Beach mystery box'),
		aliases: ['Beach mystery box'],
		output: BeachMysteryBoxTable,
		allItems: BeachMysteryBoxTable.allItems,
		excludeFromOpenAll: true
	},
	{
		name: 'Independence box',
		id: itemID('Independence box'),
		openedItem: Items.getOrThrow('Independence box'),
		aliases: ['independence box'],
		output: IndependenceBoxTable,
		allItems: IndependenceBoxTable.allItems,
		excludeFromOpenAll: true
	},
	{
		name: 'Spooky box',
		id: itemID('Spooky box'),
		openedItem: Items.getOrThrow('Spooky box'),
		aliases: ['spooky box'],
		output: spookyTable,
		allItems: spookyTable.allItems,
		excludeFromOpenAll: true
	},
	{
		name: 'Christmas box',
		id: itemID('Christmas box'),
		openedItem: Items.getOrThrow('Christmas box'),
		aliases: ['christmas box'],
		output: ChristmasBoxTable,
		allItems: ChristmasBoxTable.allItems,
		excludeFromOpenAll: true
	},
	{
		name: 'Halloween cracker',
		id: itemID('Halloween cracker'),
		openedItem: Items.getOrThrow('Halloween cracker'),
		aliases: ['halloween cracker'],
		output: HalloweenCrackerTable,
		allItems: HalloweenCrackerTable.allItems,
		smokeyApplies: false
	}
];

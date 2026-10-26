import { GearStat } from '@oldschoolgg/gear';
import { Time } from '@oldschoolgg/toolkit';
import { Bank, itemID, Monsters, resolveItems } from 'oldschooljs';

import { maggotKingCL } from '@/lib/data/CollectionsExport.js';
import { QuestID } from '@/lib/minions/data/quests.js';
import type { KillableMonster } from '@/lib/minions/types.js';
import type { GearBank } from '@/lib/structures/GearBank.js';

// Ranged + melee route. Duration, gear floors and supplies are bot balancing
// values, not fixed OSRS mechanics. Wiki ranged MMG assumes around 20 kills/h.
export const maggotKingKillable: KillableMonster = {
	id: Monsters.MaggotKing.id,
	name: Monsters.MaggotKing.name,
	aliases: [...Monsters.MaggotKing.aliases, 'maggot king (take-eggs)', 'maggot king eggs'],
	table: Monsters.MaggotKing,
	timeToFinish: Time.Minute * 3,
	respawnTime: Time.Second * 5.4,
	customMonsterHP: 1500,
	customSlayerXP: 3675,
	combatXpMultiplier: 2.45,
	requiredQuests: [QuestID.TheBloodMoonRises],
	groupKillable: false,
	wildy: false,
	levelRequirements: { attack: 80, strength: 85, defence: 70, ranged: 85, prayer: 74 },
	minimumGearRequirements: {
		melee: { [GearStat.AttackCrush]: 70, [GearStat.MeleeStrength]: 70 },
		range: { [GearStat.AttackRanged]: 100, [GearStat.RangedStrength]: 50 }
	},
	equippedItemBoosts: [
		{
			gearSetup: 'melee',
			required: false,
			items: [
				{ itemID: itemID("Inquisitor's mace"), boostPercent: 8 },
				{ itemID: itemID('Soulreaper axe'), boostPercent: 6 },
				{ itemID: itemID('Abyssal bludgeon'), boostPercent: 4 }
			]
		},
		{
			gearSetup: 'melee',
			required: false,
			items: [
				{ itemID: itemID("Inquisitor's hauberk"), boostPercent: 3 },
				{ itemID: itemID('Torva platebody'), boostPercent: 2 }
			]
		},
		{
			gearSetup: 'melee',
			required: false,
			items: [
				{ itemID: itemID("Inquisitor's plateskirt"), boostPercent: 3 },
				{ itemID: itemID('Torva platelegs'), boostPercent: 2 }
			]
		},
		{
			gearSetup: 'range',
			required: false,
			items: [
				{ itemID: itemID('Zaryte crossbow'), boostPercent: 8 },
				{ itemID: itemID('Armadyl crossbow'), boostPercent: 5 },
				{ itemID: itemID('Dragon hunter crossbow'), boostPercent: 3 },
				{ itemID: itemID('Dragon crossbow'), boostPercent: 3 }
			]
		}
	],
	itemInBankBoosts: [
		{
			[itemID('Crimson kisten')]: 6,
			[itemID('Voidwaker')]: 4,
			[itemID('Dragon claws')]: 3,
			[itemID('Burning claws')]: 2
		},
		{
			[itemID('Webweaver bow')]: 3,
			[itemID("Craw's bow")]: 3,
			[itemID('Venator bow')]: 2
		}
	],
	projectileUsage: { required: true, calculateQuantity: ({ quantity }) => quantity * 20 },
	defaultAttackStyles: ['attack', 'ranged'],
	disallowedAttackStyles: ['magic'],
	attackStyleToUse: GearStat.AttackCrush,
	attackStylesUsed: [GearStat.AttackCrush, GearStat.AttackMagic, GearStat.AttackRanged],
	healAmountNeeded: 400,
	minimumHealAmount: 20,
	itemCost: [
		{ itemCost: new Bank().add('Prayer potion(4)'), qtyPerKill: 0.5 },
		{ itemCost: new Bank().add('Super combat potion(4)'), qtyPerKill: 0.1 },
		{ itemCost: new Bank().add('Ranging potion(4)'), qtyPerKill: 0.1 },
		{ itemCost: new Bank().add('Antidote++(4)'), qtyPerKill: 0.1 }
	],
	uniques: maggotKingCL,
	notifyDrops: resolveItems(['Maggot marquess', 'Crimson kisten', 'Elder venator fang'])
};

const mageKillable: KillableMonster = {
	...maggotKingKillable,
	equippedItemBoosts: [
		...maggotKingKillable.equippedItemBoosts!.filter(boost => boost.gearSetup === 'melee'),
		{
			gearSetup: 'mage',
			required: false,
			items: [
				{ itemID: itemID('Harmonised nightmare staff'), boostPercent: 8 },
				{ itemID: itemID('Twinflame staff'), boostPercent: 6 }
			]
		},
		{
			gearSetup: 'mage',
			required: false,
			items: [{ itemID: itemID('Confliction gauntlets'), boostPercent: 4 }]
		}
	],
	// Wiki magic MMG: approximately 25 kills/hour before bot modifiers.
	timeToFinish: Time.Minute * 2.4,
	levelRequirements: { attack: 80, strength: 85, defence: 70, magic: 75, prayer: 74 },
	minimumGearRequirements: {
		melee: maggotKingKillable.minimumGearRequirements!.melee,
		mage: { [GearStat.AttackMagic]: 70 }
	},
	defaultAttackStyles: ['attack', 'magic'],
	disallowedAttackStyles: ['ranged'],
	projectileUsage: undefined,
	itemCost: [
		{ itemCost: new Bank().add('Prayer potion(4)'), qtyPerKill: 0.5 },
		{ itemCost: new Bank().add('Super combat potion(4)'), qtyPerKill: 0.1 },
		{ itemCost: new Bank().add('Antidote++(4)'), qtyPerKill: 0.1 },
		// Model thirty Fire Wave casts per kill. Fire spells are the supported mage route.
		{ itemCost: new Bank().add('Blood rune', 30).add('Fire rune', 210), qtyPerKill: 1, isRuneCost: true }
	]
};

// Select the ranged route first; fall back to fire magic if ranged gear is absent.
// Exact gear floors are bot policy. A melee weapon and a suitable distance weapon
// must actually be equipped; owning one in the bank is insufficient.
export function resolveMaggotKingMethod(gearBank: GearBank): KillableMonster | string {
	const { melee, range, mage } = gearBank.gear;
	if (!melee.equippedWeapon()) return 'Equip a melee weapon in your melee setup for Maggot King.';
	const rangeWeapon = range.equippedWeapon();
	const mageWeapon = mage.equippedWeapon();
	const crossbows = [
		'Rune crossbow',
		'Dragon crossbow',
		'Dragon hunter crossbow',
		'Armadyl crossbow',
		'Zaryte crossbow'
	];
	const fireStaves = [
		'Harmonised nightmare staff',
		'Twinflame staff',
		'Kodai wand',
		'Staff of the dead',
		'Toxic staff of the dead',
		'Purging staff'
	];
	if (
		rangeWeapon &&
		crossbows.includes(rangeWeapon.name) &&
		gearBank.skillsAsLevels.ranged >= 85 &&
		range.meetsStatRequirements(maggotKingKillable.minimumGearRequirements!.range!)[0]
	) {
		return maggotKingKillable;
	}
	if (
		mageWeapon &&
		fireStaves.includes(mageWeapon.name) &&
		gearBank.skillsAsLevels.magic >= 75 &&
		mage.meetsStatRequirements(mageKillable.minimumGearRequirements!.mage!)[0]
	) {
		if (mage.hasEquipped('Tome of fire') && gearBank.bank.amount('Burnt page') >= 2) {
			return {
				...mageKillable,
				equippedItemBoosts: [
					...mageKillable.equippedItemBoosts!,
					{
						gearSetup: 'mage',
						required: false,
						items: [{ itemID: itemID('Tome of fire'), boostPercent: 4 }]
					}
				],
				itemCost: [
					{ itemCost: new Bank().add('Prayer potion(4)'), qtyPerKill: 0.5 },
					{ itemCost: new Bank().add('Super combat potion(4)'), qtyPerKill: 0.1 },
					{ itemCost: new Bank().add('Antidote++(4)'), qtyPerKill: 0.1 },
					{
						itemCost: new Bank().add('Blood rune', 30),
						qtyPerKill: 1,
						isRuneCost: true
					},
					{
						itemCost: new Bank().add('Burnt page'),
						qtyPerKill: 1.5
					}
				]
			};
		}
		return mageKillable;
	}
	return 'Maggot King requires melee plus a ranged or fire-magic setup. Equip a crossbow with 85 Ranged and 100 ranged attack, or a fire staff with 75 Magic and 70 magic attack.';
}

export function isMaggotKingTakeEggs(name: string): boolean {
	return ['maggot king (take-eggs)', 'maggot king eggs'].includes(name.trim().toLowerCase());
}

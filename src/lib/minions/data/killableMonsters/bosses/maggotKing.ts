import { GearStat } from '@oldschoolgg/gear';
import { Time } from '@oldschoolgg/toolkit';
import { Bank, itemID, Monsters, resolveItems } from 'oldschooljs';

import { maggotKingCL } from '@/lib/data/CollectionsExport.js';
import { QuestID } from '@/lib/minions/data/quests.js';
import type { KillableMonster } from '@/lib/minions/types.js';
import type { GearBank } from '@/lib/structures/GearBank.js';

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
				{ itemID: itemID('Axe of the high sungod'), boostPercent: 15 },
				{ itemID: itemID('Drygore mace'), boostPercent: 11 },
				{ itemID: itemID("Inquisitor's mace"), boostPercent: 8 },
				{ itemID: itemID('Soulreaper axe'), boostPercent: 6 },
				{ itemID: itemID('Abyssal bludgeon'), boostPercent: 4 }
			]
		},
		{
			gearSetup: 'melee',
			required: false,
			items: [{ itemID: itemID('Offhand drygore mace'), boostPercent: 4 }]
		},
		{
			gearSetup: 'melee',
			required: false,
			items: [{ itemID: itemID("Inquisitor's hauberk"), boostPercent: 3 }]
		},
		{
			gearSetup: 'melee',
			required: false,
			items: [{ itemID: itemID("Inquisitor's plateskirt"), boostPercent: 3 }]
		},
		{
			gearSetup: 'melee',
			required: false,
			items: [{ itemID: itemID('TzKal cape'), boostPercent: 5 }]
		},
		{
			gearSetup: 'melee',
			required: false,
			items: [{ itemID: itemID("Brawler's hook necklace"), boostPercent: 5 }]
		},
		{
			gearSetup: 'melee',
			required: false,
			items: [
				{ itemID: itemID('Searcrown band'), boostPercent: 5 },
				{ itemID: itemID('Ignis ring(i)'), boostPercent: 3 }
			]
		},
		{
			gearSetup: 'range',
			required: false,
			items: [
				{ itemID: itemID('Hellfire bow'), boostPercent: 15 },
				{ itemID: itemID('Zaryte bow'), boostPercent: 11 },
				{ itemID: itemID('Twisted bow'), boostPercent: 9 },
				{ itemID: itemID('Zaryte crossbow'), boostPercent: 8 },
				{ itemID: itemID('Armadyl crossbow'), boostPercent: 5 },
				{ itemID: itemID('Dragon hunter crossbow'), boostPercent: 3 },
				{ itemID: itemID('Dragon crossbow'), boostPercent: 3 }
			]
		},
		{
			gearSetup: 'range',
			required: false,
			items: [{ itemID: itemID('Tidal collector (i)'), boostPercent: 5 }]
		},
		{
			gearSetup: 'range',
			required: false,
			items: [{ itemID: itemID('Farsight snapshot necklace'), boostPercent: 5 }]
		},
		{
			gearSetup: 'range',
			required: false,
			items: [{ itemID: itemID('Ring of piercing (i)'), boostPercent: 5 }]
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
	projectileUsage: { required: true, calculateQuantity: ({ quantity }) => quantity * 5 },
	defaultAttackStyles: ['attack', 'ranged'],
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
	itemInBankBoosts: maggotKingKillable.itemInBankBoosts?.slice(0, 1),
	equippedItemBoosts: [
		...maggotKingKillable.equippedItemBoosts!.filter(boost => boost.gearSetup === 'melee'),
		{
			gearSetup: 'mage',
			required: false,
			items: [
				{ itemID: itemID('Void staff'), boostPercent: 15 },
				{ itemID: itemID('Harmonised nightmare staff'), boostPercent: 8 },
				{ itemID: itemID('Twinflame staff'), boostPercent: 6 },
				{ itemID: itemID("Tumeken's shadow"), boostPercent: 3 }
			]
		},
		{
			gearSetup: 'mage',
			required: false,
			items: [{ itemID: itemID('Confliction gauntlets'), boostPercent: 4 }]
		},
		{
			gearSetup: 'mage',
			required: false,
			items: [{ itemID: itemID('Vasa cloak'), boostPercent: 5 }]
		},
		{
			gearSetup: 'mage',
			required: false,
			items: [{ itemID: itemID('Arcane blast necklace'), boostPercent: 5 }]
		},
		{
			gearSetup: 'mage',
			required: false,
			items: [{ itemID: itemID('Spellbound ring'), boostPercent: 5 }]
		}
	],
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
		{ itemCost: new Bank().add('Blood rune', 30).add('Fire rune', 210), qtyPerKill: 1, isRuneCost: true }
	]
};

const MAGGOT_SPAWN_BOWS = resolveItems([
	'Webweaver bow',
	"Craw's bow",
	'Venator bow',
	'Bow of faerdhinen',
	'Bow of faerdhinen (c)',
	'Magic comp bow',
	'Yew comp bow',
	'Willow comp bow',
	'Comp ogre bow',
	'Scorching bow',
	'Crystal bow'
]);

function applySpawnBowPenalty(gearBank: GearBank, monster: KillableMonster): KillableMonster {
	const hasSpawnBow = MAGGOT_SPAWN_BOWS.some(
		id => gearBank.bank.has(id) || Object.values(gearBank.gear).some(g => g.hasEquipped(id))
	);
	if (hasSpawnBow) return monster;
	return {
		...monster,
		timeToFinish: Math.round(monster.timeToFinish * 1.05)
	};
}

export function resolveMaggotKingMethod(
	gearBank: GearBank,
	attackStyles: ReturnType<MUser['getAttackStyles']> = []
): KillableMonster | string {
	const { melee, range, mage } = gearBank.gear;
	const trainingMagic = attackStyles.includes('magic');
	const trainingRanged = attackStyles.includes('ranged');

	if (trainingMagic && trainingRanged) {
		return 'For Maggot King, select either Magic or Ranged training, rather than both.';
	}
	if (!melee.equippedWeapon()) return 'Equip a melee weapon in your melee setup for Maggot King.';
	const rangeWeapon = range.equippedWeapon();
	const mageWeapon = mage.equippedWeapon();
	const crossbows = [
		'Rune crossbow',
		'Dragon crossbow',
		'Dragon hunter crossbow',
		'Armadyl crossbow',
		'Zaryte crossbow',
		'Twisted bow',
		'Hellfire bow',
		'Zaryte bow'
	];
	const fireStaves = [
		'Void staff',
		"Tumeken's shadow",
		'Harmonised nightmare staff',
		'Twinflame staff',
		'Kodai wand',
		'Staff of the dead',
		'Toxic staff of the dead',
		'Purging staff'
	];
	if (
		!trainingMagic &&
		rangeWeapon &&
		crossbows.includes(rangeWeapon.name) &&
		gearBank.skillsAsLevels.ranged >= 85 &&
		range.meetsStatRequirements(maggotKingKillable.minimumGearRequirements!.range!)[0]
	) {
		return applySpawnBowPenalty(gearBank, maggotKingKillable);
	}
	if (
		!trainingRanged &&
		mageWeapon &&
		fireStaves.includes(mageWeapon.name) &&
		gearBank.skillsAsLevels.magic >= 75 &&
		mage.meetsStatRequirements(mageKillable.minimumGearRequirements!.mage!)[0]
	) {
		if (mageWeapon.name === "Tumeken's shadow") {
			return applySpawnBowPenalty(gearBank, {
				...mageKillable,
				itemCost: [
					{ itemCost: new Bank().add('Prayer potion(4)'), qtyPerKill: 0.5 },
					{ itemCost: new Bank().add('Super combat potion(4)'), qtyPerKill: 0.1 },
					{ itemCost: new Bank().add('Antidote++(4)'), qtyPerKill: 0.1 },
					{
						itemCost: new Bank().add('Soul rune', 60).add('Chaos rune', 150),
						qtyPerKill: 1,
						isRuneCost: true
					}
				]
			});
		}
		if (mage.hasEquipped('Tome of fire') && gearBank.bank.amount('Burnt page') >= 2) {
			return applySpawnBowPenalty(gearBank, {
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
			});
		}
		return applySpawnBowPenalty(gearBank, mageKillable);
	}
	const rangedMissing: string[] = [];
	const magicMissing: string[] = [];

	if (!rangeWeapon || !crossbows.includes(rangeWeapon.name)) {
		rangedMissing.push('Your minion needs to have a crossbow, or a twisted bow.');
	}
	if (gearBank.skillsAsLevels.ranged < 85) {
		rangedMissing.push(`85 Ranged required (you have ${gearBank.skillsAsLevels.ranged}).`);
	}
	if (range.stats[GearStat.AttackRanged] < 100) {
		rangedMissing.push(`100 ranged attack required (you have ${range.stats[GearStat.AttackRanged]}).`);
	}
	if (range.stats[GearStat.RangedStrength] < 50) {
		rangedMissing.push(`50 ranged strength required (you have ${range.stats[GearStat.RangedStrength]}).`);
	}

	if (!mageWeapon || !fireStaves.includes(mageWeapon.name)) {
		magicMissing.push("Your minion needs to have gear for casting fire spells, or a Tumeken's shadow.");
	}
	if (gearBank.skillsAsLevels.magic < 75) {
		magicMissing.push(`75 Magic required (you have ${gearBank.skillsAsLevels.magic}).`);
	}
	if (mage.stats[GearStat.AttackMagic] < 70) {
		magicMissing.push(`70 magic attack required (you have ${mage.stats[GearStat.AttackMagic]}).`);
	}

	if (trainingRanged) {
		return `Maggot King - your Ranged setup is missing:\n- ${rangedMissing.join('\n- ')}`;
	}
	if (trainingMagic) {
		return `Maggot King - your Magic setup is missing:\n- ${magicMissing.join('\n- ')}`;
	}

	return [
		'Maggot King requires one of these setups:',
		`Ranged - missing:\n- ${rangedMissing.join('\n- ')}`,
		`Magic - missing:\n- ${magicMissing.join('\n- ')}`
	].join('\n\n');
}

export function isMaggotKingTakeEggs(name: string): boolean {
	return ['maggot king (take-eggs)', 'maggot king eggs'].includes(name.trim().toLowerCase());
}

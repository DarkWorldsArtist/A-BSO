import { MathRNG } from 'node-rng';
import { Bank, Monsters } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import {
	isMaggotKingTakeEggs,
	maggotKingKillable,
	resolveMaggotKingMethod
} from '@/lib/minions/data/killableMonsters/bosses/maggotKing.js';
import { QuestID } from '@/lib/minions/data/quests.js';
import { addMonsterXPRaw } from '@/lib/minions/functions/addMonsterXPRaw.js';
import { Gear } from '@/lib/structures/Gear.js';
import { makeGearBank } from './utils.js';
import findMonster from '@/lib/util/findMonster.js';
import { autocompleteMonsters } from '@/lib/minions/data/killableMonsters/index.js';

function makeCombatGear() {
	const gear = makeGearBank();
	gear.gear.melee = new Gear({ weapon: "Inquisitor's mace", neck: 'Amulet of torture' });
	return gear;
}

function equipRanged(gear: ReturnType<typeof makeGearBank>) {
	gear.gear.range = new Gear({
		weapon: 'Zaryte crossbow',
		body: 'Armadyl chestplate',
		legs: 'Armadyl chainskirt',
		ammo: 'Ruby dragon bolts (e)'
	});
}

function equipMage(gear: ReturnType<typeof makeGearBank>) {
	gear.gear.mage = new Gear({
		weapon: 'Kodai wand',
		body: "Ahrim's robetop",
		legs: "Ahrim's robeskirt",
		neck: 'Occult necklace',
		cape: 'Imbued saradomin cape'
	});
}

describe('Maggot King PvM', () => {
	test('Only egg target names enable Take-eggs mode', () => {
		expect(isMaggotKingTakeEggs('Maggot King (Take-eggs)')).toBe(true);
		expect(isMaggotKingTakeEggs('maggot king eggs')).toBe(true);
		expect(isMaggotKingTakeEggs('  MAGGOT KING (TAKE-EGGS)  ')).toBe(true);

		expect(isMaggotKingTakeEggs('Maggot King')).toBe(false);
		expect(isMaggotKingTakeEggs('maggotking')).toBe(false);
		expect(isMaggotKingTakeEggs('Goblin')).toBe(false);
	});
	test('Take-eggs is selectable and shares the Maggot King identity', () => {
		const choice = autocompleteMonsters.find(
			monster => monster.name === 'Maggot King (Take-eggs)'
		);

		expect(choice).toBeDefined();
		expect(choice?.id).toBe(Monsters.MaggotKing.id);
		expect(findMonster('Maggot King (Take-eggs)')).toBe(maggotKingKillable);
		expect(findMonster('maggot king eggs')).toBe(maggotKingKillable);
		expect(findMonster('Maggot King')).toBe(maggotKingKillable);
	});
	test('requires the named quest and cannot be group killed', () => {
		expect(maggotKingKillable.requiredQuests).toContain(QuestID.TheBloodMoonRises);
		expect(maggotKingKillable.groupKillable).toBe(false);
	});

	test('rejects bank-only gear and melee-only combat', () => {
		const gear = makeGearBank({ bank: new Bank().add("Inquisitor's mace").add('Zaryte crossbow') });
		expect(typeof resolveMaggotKingMethod(gear)).toBe('string');
		expect(typeof resolveMaggotKingMethod(makeCombatGear())).toBe('string');
	});

	test('accepts ranged plus melee', () => {
		const gear = makeCombatGear();
		equipRanged(gear);
		expect(resolveMaggotKingMethod(gear)).toBe(maggotKingKillable);
	});

	test('supports magic without requiring a ranged setup', () => {
		const gear = makeCombatGear();
		equipMage(gear);
		const method = resolveMaggotKingMethod(gear);
		if (typeof method === 'string') throw new Error(method);
		expect(method.id).toBe(Monsters.MaggotKing.id);
		expect(method.defaultAttackStyles).toContain('magic');
		expect(method.levelRequirements?.ranged).toBeUndefined();
		expect(method.projectileUsage).toBeUndefined();
	});

	test('does not accept a ranged method below its skill floor', () => {
		const gear = makeCombatGear();
		equipRanged(gear);
		gear.skillsAsLevels.ranged = 84;
		expect(typeof resolveMaggotKingMethod(gear)).toBe('string');
	});

	test('uses stable ranged-first selection when both setups are available', () => {
		const gear = makeCombatGear();
		equipRanged(gear);
		equipMage(gear);
		expect(resolveMaggotKingMethod(gear)).toBe(maggotKingKillable);
	});

	test('awards correct combat and Slayer XP without generated NPC metadata', () => {
		const xp = addMonsterXPRaw({
			rng: MathRNG,
			monsterID: Monsters.MaggotKing.id,
			quantity: 2,
			duration: 360000,
			isOnTask: true,
			taskQuantity: 2,
			attackStyles: ['attack']
		});
		expect(xp.amount('attack')).toBe(29400);
		expect(xp.amount('slayer')).toBe(7350);
	});
});

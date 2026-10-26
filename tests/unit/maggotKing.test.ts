import { MathRNG } from 'node-rng';
import { Bank, Monsters } from 'oldschooljs';
import { describe, expect, test } from 'vitest';

import Createables from '@/lib/data/createables.js';
import {
	isMaggotKingTakeEggs,
	maggotKingKillable,
	resolveMaggotKingMethod
} from '@/lib/minions/data/killableMonsters/bosses/maggotKing.js';
import { autocompleteMonsters } from '@/lib/minions/data/killableMonsters/index.js';
import { QuestID } from '@/lib/minions/data/quests.js';
import { addMonsterXPRaw } from '@/lib/minions/functions/addMonsterXPRaw.js';
import MiscCraftables from '@/lib/skilling/skills/crafting/craftables/misc.js';
import { Gear } from '@/lib/structures/Gear.js';
import findMonster from '@/lib/util/findMonster.js';
import { makeGearBank } from './utils.js';

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
	test('Necklace of rupture requires both ingredients and awards 500 Crafting XP', () => {
		const recipe = MiscCraftables.find(item => item.name === 'Necklace of rupture');
		if (!recipe) throw new Error('Necklace recipe missing');

		expect(recipe.level).toBe(84);
		expect(recipe.xp).toBe(500);
		expect(recipe.inputItems.amount('Necklace of anguish')).toBe(1);
		expect(recipe.inputItems.amount('Etched elder venator fang')).toBe(1);
	});
	test('Etching requires 84 Crafting and consumes only the fang', () => {
		const recipe = Createables.find(item => item.name === 'Etched elder venator fang');
		if (!recipe) throw new Error('Etching recipe missing');

		const inputs = new Bank(recipe.inputItems);
		const outputs = new Bank(recipe.outputItems);

		expect(recipe.requiredSkills?.crafting).toBe(84);
		expect(inputs.amount('Elder venator fang')).toBe(1);
		expect(inputs.amount('Chisel')).toBe(0);
		expect(outputs.amount('Etched elder venator fang')).toBe(1);
		expect(recipe.customReq).toBeDefined();
	});
	test('Tome of fire uses pages and falls back when pages are unavailable', () => {
		const gear = makeCombatGear();
		gear.gear.mage = new Gear({
			weapon: 'Kodai wand',
			body: "Ahrim's robetop",
			legs: "Ahrim's robeskirt",
			neck: 'Occult necklace',
			cape: 'Imbued saradomin cape',
			shield: 'Tome of fire'
		});
		gear.bank.add('Burnt page', 2);

		const method = resolveMaggotKingMethod(gear);
		if (typeof method === 'string') throw new Error(method);
		if (!Array.isArray(method.itemCost)) throw new Error('Expected supply list');

		expect(method.itemCost.some(cost => cost.itemCost.has('Fire rune'))).toBe(false);
		expect(method.itemCost.find(cost => cost.itemCost.has('Burnt page'))?.qtyPerKill).toBe(1.5);

		gear.bank.remove('Burnt page', 2);

		const fallback = resolveMaggotKingMethod(gear);
		if (typeof fallback === 'string') throw new Error(fallback);
		if (!Array.isArray(fallback.itemCost)) throw new Error('Expected supply list');

		expect(fallback.itemCost.some(cost => cost.itemCost.has('Fire rune'))).toBe(true);
		expect(fallback.itemCost.some(cost => cost.itemCost.has('Burnt page'))).toBe(false);
	});
	test('Magic route includes melee and magic boosts, but no ranged boosts', () => {
		const gear = makeCombatGear();
		equipMage(gear);

		const method = resolveMaggotKingMethod(gear);
		if (typeof method === 'string') throw new Error(method);

		const setups = method.equippedItemBoosts!.map(boost => boost.gearSetup);

		expect(setups).toContain('melee');
		expect(setups).toContain('mage');
		expect(setups).not.toContain('range');
	});
	test('Only egg target names enable Take-eggs mode', () => {
		expect(isMaggotKingTakeEggs('Maggot King (Take-eggs)')).toBe(true);
		expect(isMaggotKingTakeEggs('maggot king eggs')).toBe(true);
		expect(isMaggotKingTakeEggs('  MAGGOT KING (TAKE-EGGS)  ')).toBe(true);

		expect(isMaggotKingTakeEggs('Maggot King')).toBe(false);
		expect(isMaggotKingTakeEggs('maggotking')).toBe(false);
		expect(isMaggotKingTakeEggs('Goblin')).toBe(false);
	});
	test('Take-eggs is selectable and shares the Maggot King identity', () => {
		const choice = autocompleteMonsters.find(monster => monster.name === 'Maggot King (Take-eggs)');

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

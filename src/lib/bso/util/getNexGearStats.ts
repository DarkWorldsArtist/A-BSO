import { gorajanArcherOutfit, pernixOutfit } from '@/lib/bso/collection-log/main.js';
import { NexMonster } from '@/lib/bso/monsters/nex.js';

import type { GearStats } from '@oldschoolgg/gear';
import { calcWhatPercent } from '@oldschoolgg/toolkit';
import { randInt } from 'node-rng';

import { maxOffenceStats } from '@/lib/structures/Gear.js';

export async function getNexGearStats(
	user: MUser,
	team: string[]
): Promise<
	[
		{
			chanceOfDeath: number;
			damageDone: number;
			dps: number;
			percentRangeStrength: number;
			totalGearPercent: number;
			percentWeaponAttackRanged: number;
			attackRangedStat: number;
			kc: number;
			gearStats: GearStats;
		},
		string
	]
> {
	const kc = await user.getKC(NexMonster.id);
	const gear = user.gear.range;
	const weapon = gear.equippedWeapon();
	const gearStats = gear.stats;
	const percentRangeStrength = calcWhatPercent(
		gearStats.attack_ranged + gearStats.ranged_strength,
		maxOffenceStats.attack_ranged + gearStats.ranged_strength
	);
	const attackRangedStat = weapon?.equipment?.attack_ranged ?? 0;
	const percentWeaponAttackRanged = Math.min(calcWhatPercent(attackRangedStat, 95), 100);
	const totalGearPercent = Math.min((percentRangeStrength + percentWeaponAttackRanged) / 2, 100);

	let dps = 100 * (totalGearPercent / 100);
	if (attackRangedStat < 69) {
		dps /= 1.5;
	}
	if (gear.hasEquipped('Zaryte bow', true, true)) {
		dps *= 1.2;
	} else if (gear.hasEquipped('Twisted bow', true, true)) {
		dps *= 1.15;
	}
	if (gear.hasEquipped(pernixOutfit, true, true)) {
		dps *= 1.2;
	} else {
		for (const inqItem of pernixOutfit) {
			if (gear.hasEquipped([inqItem], true, true)) {
				dps *= 1.024;
			}
		}
	}
	if (gear.hasEquipped(gorajanArcherOutfit, true, true)) {
		dps *= 1.15;
	}
	if (kc > 500) {
		dps *= 1.15;
	} else if (kc > 300) {
		dps *= 1.13;
	} else if (kc > 200) {
		dps *= 1.1;
	} else if (kc > 100) {
		dps *= 1.07;
	} else if (kc > 50) {
		dps *= 1.05;
	}
	dps = Math.max(10, dps);

	let percentChanceOfDeath = 5;
	if (kc < 2) {
		percentChanceOfDeath = randInt(50, 70);
	} else if (kc < 5) {
		percentChanceOfDeath = randInt(30, 50);
	} else if (kc < 10) {
		percentChanceOfDeath = randInt(20, 40);
	} else if (kc < 20) {
		percentChanceOfDeath = randInt(10, 30);
	} else {
		percentChanceOfDeath = randInt(1, 4);
	}

	if (totalGearPercent > 80) {
		percentChanceOfDeath = Math.max(1, percentChanceOfDeath - 2);
	}

	const damageDone = Math.round(6000 / team.length);

	const debugString = `\n**${user.usernameOrMention}:** DPS[${Math.floor(dps)}] DeathChance[${Math.floor(
		percentChanceOfDeath
	)}%] WeaponStrength[${Math.floor(percentWeaponAttackRanged)}%] GearStrength[${Math.floor(
		percentRangeStrength
	)}%] TotalGear[${totalGearPercent}%]\n`;

	return [
		{
			chanceOfDeath: percentChanceOfDeath,
			damageDone,
			dps,
			percentRangeStrength,
			totalGearPercent,
			percentWeaponAttackRanged,
			attackRangedStat,
			kc,
			gearStats
		},
		debugString
	];
}

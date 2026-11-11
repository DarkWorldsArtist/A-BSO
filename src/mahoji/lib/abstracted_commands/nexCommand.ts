import { calcBossFood } from '@/lib/bso/calcBossFood.js';
import { gorajanArcherOutfit, pernixOutfit } from '@/lib/bso/collection-log/main.js';
import { NexMonster } from '@/lib/bso/monsters/nex.js';
import { getNexGearStats } from '@/lib/bso/util/getNexGearStats.js';

import { formatDuration, increaseNumByPercent, isWeekend, reduceNumByPercent, Time } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import { trackLoot } from '@/lib/lootTrack.js';
import calculateMonsterFood from '@/lib/minions/functions/calculateMonsterFood.js';
import type { KillableMonster } from '@/lib/minions/types.js';
import type { MakePartyOptions } from '@/lib/types/index.js';
import type { BossActivityTaskOptions } from '@/lib/types/minions.js';
import calcDurQty from '@/lib/util/calcMassDurationQuantity.js';

async function checkReqs(users: MUser[], monster: KillableMonster, quantity: number): Promise<string | undefined> {
	// Check if every user has the requirements for this monster.
	for (const user of users) {
		if (!user.user.minion_hasBought) {
			return `${user.usernameOrMention} doesn't have a minion, so they can't join!`;
		}

		if (await user.minionIsBusy()) {
			return `${user.usernameOrMention} is busy right now and can't join!`;
		}

		const [hasReqs, reason] = await user.hasMonsterRequirements(monster);
		if (!hasReqs) {
			return `${user.usernameOrMention} doesn't have the requirements for this monster: ${reason}`;
		}

		if (!user.owns('Frozen key')) {
			return `${user} doesn't have a Frozen key.`;
		}

		const potionsRequired = await calcBossFood(user, NexMonster, users.length, quantity);
		if (!user.bank.has(potionsRequired)) {
			return `${
				users.length === 1 ? "You don't" : `${user.usernameOrMention} doesn't`
			} have enough brews/restores. You need at least ${potionsRequired} to ${
				users.length === 1 ? 'start the mass' : 'enter the mass'
			}.`;
		}
	}
}

export async function nexCommand(
	interaction: MInteraction,
	user: MUser,
	channelId: string,
	inputName: string,
	inputQuantity: number | undefined
) {
	await interaction.defer();
	const userBank = user.bank;
	if (!userBank.has('Frozen key')) {
		return `${user.minionName} attempts to enter the Ancient Prison to fight Nex, but finds a giant frozen, metal door blocking their way.`;
	}
	const type = inputName.toLowerCase().includes('mass') ? 'mass' : 'solo';

	const failureReason = await checkReqs([user], NexMonster, 2);
	if (failureReason) return failureReason;

	const partyOptions: MakePartyOptions = {
		interaction,
		leader: user,
		minSize: 2,
		maxSize: 8,
		ironmanAllowed: true,
		message: `${user.usernameOrMention} is doing a ${NexMonster.name} mass! Use the buttons below to join/leave.`,
		customDenier: async user => {
			if (!user.user.minion_hasBought) {
				return [true, "you don't have a minion."];
			}
			if (await user.minionIsBusy()) {
				return [true, 'your minion is busy.'];
			}
			const [hasReqs, reason] = await user.hasMonsterRequirements(NexMonster);
			if (!hasReqs) {
				return [true, `you don't have the requirements for this monster; ${reason}`];
			}

			if (!user.hasEquippedOrInBank('Frozen key')) {
				return [true, `${user} doesn't have a Frozen key.`];
			}

			if (NexMonster.healAmountNeeded) {
				try {
					calculateMonsterFood(NexMonster, user);
				} catch (err: any) {
					return [true, err];
				}

				// Ensure people have enough food for at least 10 kills.
				// We don't want to overshoot, as the mass will still fail if there's not enough food
				const potionReq = await calcBossFood(user, NexMonster, 1, 10);
				if (!user.bank.has(potionReq)) {
					return [true, `You don't have enough food. You need at least ${potionReq} to Join the mass.`];
				}
			}

			return [false];
		}
	};

	const users: MUser[] = type === 'mass' ? await globalClient.makeParty(partyOptions) : [user];
	if (await ActivityManager.anyMinionIsBusy(users)) {
		return `One of the minions in the party is already busy.`;
	}

	let debugStr = '';
	let effectiveTime = NexMonster.timeToFinish;
	if (isWeekend()) {
		effectiveTime = reduceNumByPercent(effectiveTime, 5);
		debugStr += '5% Weekend boost\n';
	}
	const isSolo = users.length === 1;

	const soloKC = await users[0].getKC(NexMonster.id);
	if (isSolo && soloKC < 200) {
		effectiveTime = increaseNumByPercent(effectiveTime, 20);
	}

	if (isSolo && soloKC > 500) {
		effectiveTime = reduceNumByPercent(effectiveTime, 20);
	}

	let totalTeamBoost = 0;
	for (const user of users) {
		const [data] = await getNexGearStats(
			user,
			users.map(u => u.id)
		);
		debugStr += `**${user.usernameOrMention}**: `;
		const msgs = [];
		let userBoost = 0;

		const rangeGear = user.gear.range;
		if (rangeGear.hasEquipped(pernixOutfit, true, true)) {
			userBoost += 20;
			msgs.push('20% boost for full pernix');
		} else {
			let i = 0;
			for (const inqItem of pernixOutfit) {
				if (rangeGear.hasEquipped([inqItem], true, true)) {
					i += 2.4;
				}
			}
			if (i > 0) {
				userBoost += i;
				msgs.push(`${i.toFixed(1)}% boost for pernix items`);
			}
		}

		if (rangeGear.hasEquipped(gorajanArcherOutfit, true, true)) {
			userBoost += 15;
			msgs.push('15% for Gorajan archer');
		}

		const hasPernixOrGorajan =
			rangeGear.hasEquipped(pernixOutfit, false, true) || rangeGear.hasEquipped(gorajanArcherOutfit, false, true);
		if (!hasPernixOrGorajan) {
			const hasMasori =
				rangeGear.hasEquipped(['Masori body (f)', 'Masori chaps (f)', 'Masori mask (f)'], true, true) ||
				rangeGear.hasEquipped(['Masori body', 'Masori chaps', 'Masori mask'], true, true);
			if (hasMasori) {
				userBoost += 10;
				msgs.push('10% boost for full Masori');
			} else if (
				rangeGear.hasEquipped(['Armadyl chestplate', 'Armadyl chainskirt', 'Armadyl helmet'], true, true)
			) {
				userBoost += 5;
				msgs.push('5% boost for full Armadyl');
			}
		}

		if (rangeGear.hasEquipped('Zaryte bow', true, true)) {
			userBoost += 20;
			msgs.push('20% boost for Zaryte bow');
		} else if (rangeGear.hasEquipped('Zaryte crossbow', true, true)) {
			userBoost += 15;
			msgs.push('15% boost for Zaryte crossbow');
		} else if (rangeGear.hasEquipped('Twisted bow', true, true)) {
			userBoost += 15;
			msgs.push('15% boost for Twisted bow');
		} else if (rangeGear.hasEquipped('Bow of faerdhinen (c)', true, true)) {
			userBoost += 12;
			msgs.push('12% boost for Bow of faerdhinen (c)');
		} else if (rangeGear.hasEquipped(['Armadyl crossbow', 'Dragon hunter crossbow'], false, true)) {
			userBoost += 10;
			msgs.push('10% boost for Crossbow');
		} else if (rangeGear.hasEquipped('Dragon crossbow', true, true)) {
			userBoost += 5;
			msgs.push('5% boost for Dragon crossbow');
		}

		if (data.kc > 500) {
			userBoost += 15;
			msgs.push('15% for over 500 kc');
		} else if (data.kc > 300) {
			userBoost += 13;
			msgs.push('13% for over 300 kc');
		} else if (data.kc > 200) {
			userBoost += 10;
			msgs.push('10% for over 200 kc');
		} else if (data.kc > 100) {
			userBoost += 7;
			msgs.push('7% for over 100 kc');
		} else if (data.kc > 50) {
			userBoost += 5;
			msgs.push('5% for over 50 kc');
		}

		totalTeamBoost += userBoost;
		if (msgs.length === 0) {
			msgs.push('no gear boosts');
		}
		debugStr += `${msgs.join(', ')}. `;
	}

	if (isSolo) {
		effectiveTime = reduceNumByPercent(effectiveTime, Math.min(75, totalTeamBoost));
	} else {
		const avgTeamBoost = totalTeamBoost / users.length;
		effectiveTime = reduceNumByPercent(effectiveTime, Math.min(75, avgTeamBoost));
	}

	let minDuration = 2;
	if (users.length === 4) minDuration = 1.5;
	if (users.length === 5) minDuration = 1.2;
	if (users.length >= 6) minDuration = 1;

	const durQtyRes = await calcDurQty(
		users,
		{ ...NexMonster, timeToFinish: effectiveTime },
		inputQuantity,
		Time.Minute * minDuration,
		Time.Minute * 30
	);
	if (typeof durQtyRes === 'string') return durQtyRes;
	const [quantity, duration, perKillTime] = durQtyRes;
	const secondCheck = await checkReqs(users, NexMonster, quantity);
	if (secondCheck) return secondCheck;

	let foodString = 'Removed brews/restores from users: ';
	const foodRemoved: string[] = [];
	for (const user of users) {
		const food = await calcBossFood(user, NexMonster, users.length, quantity);
		if (!user.bank.has(food)) {
			return `${user.usernameOrMention} doesn't have enough brews or restores.`;
		}
	}

	const removeResult = await Promise.all(
		users.map(async user => {
			const cost = await calcBossFood(user, NexMonster, users.length, quantity);
			foodRemoved.push(`${cost} from ${user.usernameOrMention}`);
			await user.removeItemsFromBank(cost);
			return {
				id: user.id,
				cost
			};
		})
	);

	const totalCost = new Bank();
	for (const u of removeResult) totalCost.add(u.cost);

	await trackLoot({
		changeType: 'cost',
		totalCost,
		id: NexMonster.name,
		type: 'Monster',
		users: removeResult.map(i => ({
			id: i.id,
			cost: i.cost
		}))
	});

	foodString += `${foodRemoved.join(', ')}.`;

	await ActivityManager.startTrip<BossActivityTaskOptions>({
		userID: user.id,
		channelId,
		quantity,
		duration,
		type: 'Nex',
		users: users.map(u => u.id)
	});

	await ClientSettings.updateBankSetting('nex_cost', totalCost);

	let str =
		type === 'solo'
			? `Your minion is now attempting to kill ${quantity}x Nex. ${foodString} The trip will take ${formatDuration(duration)}.`
			: `${partyOptions.leader.usernameOrMention}'s party (${users
					.map(u => u.usernameOrMention)
					.join(', ')}) is now off to kill ${quantity}x ${NexMonster.name}. Each kill takes ${formatDuration(
					perKillTime
				)} instead of ${formatDuration(NexMonster.timeToFinish)} - the total trip will take ${formatDuration(
					duration
				)}. ${foodString}`;

	str += ` \n\n${debugStr}`;

	return str;
}

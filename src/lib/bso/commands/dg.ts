import type { DungeoneeringOptions } from '@/lib/bso/bsoTypes.js';
import {
	allFloors,
	determineDgLevelForFloor,
	dungBuyables,
	type Floor,
	floorNonCombatLevels,
	isValidFloor,
	requiredLevel,
	requiredSkills
} from '@/lib/bso/skills/dungoneering/dungData.js';
import {
	calcMaxFloorUserCanDo,
	calcUserGorajanShardChance,
	checkKinshipFloorSpread,
	getCurrentKinshipTier,
	getDungeoneeringFloorCompletions,
	getMissingSkillsForFloor,
	hasRequiredLevels,
	numberOfGorajanOutfitsEquipped
} from '@/lib/bso/skills/dungoneering/dungDbFunctions.js';
import { InventionID } from '@/lib/bso/skills/invention/inventions.js';

import { formatDuration, formatOrdinal, reduceNumByPercent, stringMatches, Time } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import type { MakePartyOptions } from '@/lib/types/index.js';
import { formatSkillRequirements } from '@/lib/util/smallUtils.js';

// Max people in a party:
const maxTeamSize = 20;

async function startCommand(
	interaction: MInteraction,
	channelId: string,
	user: MUser,
	floor: string | undefined,
	solo: boolean | undefined
) {
	const isSolo = Boolean(solo);

	const floorToDo = floor ? Number(floor) : calcMaxFloorUserCanDo(user);

	if (!isValidFloor(floorToDo)) {
		return "That's an invalid floor.";
	}

	if (determineDgLevelForFloor(floorToDo) > user.skillsAsLevels.dungeoneering) {
		return `You need level ${determineDgLevelForFloor(floorToDo)} to do Floor ${floorToDo}.`;
	}

	const dungeonLength = Time.Minute * 5 * (floorToDo / 2);
	let quantity = Math.floor((await user.calcMaxTripLength('Dungeoneering')) / dungeonLength);
	let duration = quantity * dungeonLength;

	const message = `${user.usernameOrMention} has created a Dungeoneering party! Use the buttons below to join/leave.
**Floor:** ${floorToDo}
**Duration:** ${formatDuration(duration)}
**Min. Quantity:** ${quantity}
**Required Stats:** ${formatSkillRequirements(requiredSkills(floorToDo))}`;

	const partyOptions: MakePartyOptions = {
		interaction,
		leader: user,
		minSize: 1,
		maxSize: maxTeamSize,
		ironmanAllowed: true,
		message,
		customDenier: async partyUser => {
			if (!partyUser.user.minion_hasBought) {
				return [true, "you don't have a minion."];
			}
			if (await partyUser.minionIsBusy()) {
				return [true, 'your minion is busy.'];
			}

			if (partyUser.skillsAsLevels.dungeoneering < determineDgLevelForFloor(floorToDo)) {
				return [
					true,
					`you need level ${determineDgLevelForFloor(floorToDo)} Dungeoneering for Floor ${floorToDo}.`
				];
			}

			if (isSolo && !hasRequiredLevels(partyUser, floorToDo)) {
				return [
					true,
					`you don't have the required stats for this floor, you need: ${formatSkillRequirements(
						requiredSkills(floorToDo)
					)}.`
				];
			}

			return [false];
		}
	};

	const leaderCheck = await partyOptions.customDenier!(user);
	if (leaderCheck[0]) {
		return `You can't start a Dungeoneering party for Floor ${floorToDo} because ${leaderCheck[1]}`;
	}

	const users: MUser[] = isSolo ? [user] : await globalClient.makeParty(partyOptions);
	if (await ActivityManager.anyMinionIsBusy(users)) {
		return 'One or more party members have their minion busy.';
	}

	const reqSkills = requiredSkills(floorToDo);
	const missingSkills: string[] = [];
	for (const [skill, level] of Object.entries(reqSkills)) {
		if (skill === 'dungeoneering') continue;
		const maxLevelInParty = Math.max(
			...users.map(u => u.skillsAsLevels[skill as keyof typeof u.skillsAsLevels] ?? 0)
		);
		if (maxLevelInParty < level) {
			missingSkills.push(`${level} ${skill}`);
		}
	}
	if (missingSkills.length > 0) {
		return `Your party does not meet the skill requirements for Floor ${floorToDo}. No party member has: ${missingSkills.join(
			', '
		)}.`;
	}

	const boosts = [];
	let teleBoost = 0;
	for (const u of users) {
		if (u.owns('Scroll of teleportation')) {
			let b = 15;
			if (u.hasEquippedOrInBank('Dungeoneering master cape')) {
				b = 25;
			} else if (u.hasEquippedOrInBank('Dungeoneering cape') || u.hasEquippedOrInBank('Dungeoneering cape(t)')) {
				b = 20;
			}
			if (b > teleBoost) teleBoost = b;
		}
	}
	if (teleBoost > 0) {
		duration = reduceNumByPercent(duration, teleBoost);
		boosts.push(`${teleBoost}% from Scroll of teleportation`);
	}

	let totalGorajanOutfits = 0;
	for (const u of users) {
		totalGorajanOutfits += numberOfGorajanOutfitsEquipped(u);
	}
	const goraPercent = Math.min(30, totalGorajanOutfits * 6);
	if (goraPercent > 0) {
		duration = reduceNumByPercent(duration, goraPercent);
		boosts.push(`${goraPercent}% from Gorajan armour`);
	}

	if (users.some(u => u.owns("Smuggler's lockpick"))) {
		duration = reduceNumByPercent(duration, 10);
		boosts.push("10% from Smuggler's lockpick");
	}

	if (users.some(u => u.owns('Alyra') || u.usingPet('Alyra'))) {
		duration = reduceNumByPercent(duration, 10);
		boosts.push('10% from Alyra');
	}

	let bestKinshipBoost = 0;
	for (const u of users) {
		let b = 0;
		if (u.owns('Overcharged ring of kinship')) {
			b = 10;
		} else if (u.owns('Ring of kinship (tier 4)')) {
			b = 8;
		} else if (u.owns('Ring of kinship (tier 3)')) {
			b = 7;
		} else if (u.owns('Ring of kinship (tier 2)')) {
			b = 6;
		} else if (u.owns('Ring of kinship (tier 1)')) {
			b = 5;
		}
		if (b > bestKinshipBoost) bestKinshipBoost = b;
	}
	if (bestKinshipBoost > 0) {
		duration = reduceNumByPercent(duration, bestKinshipBoost);
		boosts.push(`${bestKinshipBoost}% from Ring of kinship`);
	}

	duration = reduceNumByPercent(duration, 20);

	if (users.length > 1) {
		const teamBoost = Math.min(20, (users.length - 1) * 5);
		duration = reduceNumByPercent(duration, teamBoost);
		boosts.push(`${teamBoost}% for ${users.length}-player team`);
	}

	const perFloor = duration / quantity;
	quantity = Math.max(1, Math.floor((await user.calcMaxTripLength('Dungeoneering')) / perFloor));
	duration = quantity * perFloor;

	let str = `${partyOptions.leader.usernameOrMention}'s dungeoneering party (${users
		.map(u => u.usernameOrMention)
		.join(', ')}) is now off to do ${quantity}x dungeons of the ${formatOrdinal(
		floorToDo
	)} floor. Each dungeon takes ${formatDuration(perFloor)} - the total trip will take ${formatDuration(duration)}.`;

	if (boosts.length > 0) {
		str += `\n\n**Boosts:** ${boosts.join(', ')}.`;
	}

	await ActivityManager.startTrip<DungeoneeringOptions>({
		userID: user.id,
		channelId,
		quantity,
		duration,
		type: 'Dungeoneering',
		leader: user.id,
		users: users.map(u => u.id),
		floor: floorToDo
	});

	return str;
}

async function buyCommand(user: MUser, name?: string, quantity?: number) {
	const buyable = dungBuyables.find(i => stringMatches(name, i.item.name));
	if (!buyable) {
		let msg = `${dungBuyables.map(i => `**${i.item.name}:** ${i.cost.toLocaleString()} tokens`).join('\n')}.`;
		if (name !== undefined) msg = `**That isn't a buyable item**. Here are the items you can buy:\n\n${msg}`;
		return msg;
	}

	if (!quantity) {
		quantity = 1;
	}

	const { item, cost } = buyable;
	const overallCost = cost * quantity;
	const balance = user.user.dungeoneering_tokens;

	if (buyable.item.name === 'Clue codex') {
		if (quantity > 1) {
			return 'You can only purchase 1 Clue codex upgrade at a time.';
		}
		if (user.owns('Clue codex')) {
			return 'You already own the Clue codex.';
		}
		if (!user.owns('Clue upgrader')) {
			return 'You must own a Clue upgrader to purchase the Clue codex upgrade.';
		}
		if (!user.bank.has('Clue upgrader')) {
			return 'Your Clue upgrader must be in your bank to upgrade it.';
		}
		if (balance < overallCost) {
			return `You don't have enough Dungeoneering tokens to buy the Clue codex upgrade. You need ${overallCost.toLocaleString()}, but you have only ${balance.toLocaleString()}.`;
		}

		await user.removeItemsFromBank(new Bank().add('Clue upgrader', 1));
		await user.addItemsToBank({ items: new Bank().add('Clue codex', 1), collectionLog: true });
		await user.update({
			dungeoneering_tokens: {
				decrement: overallCost
			},
			unlocked_blueprints: user.user.unlocked_blueprints.includes(InventionID.ClueCodex)
				? undefined
				: {
						push: InventionID.ClueCodex
					}
		});

		return `Successfully upgraded your Clue upgrader into a Clue codex for ${overallCost.toLocaleString()} Dungeoneering tokens.`;
	}

	if (balance < overallCost) {
		return `You don't have enough Dungeoneering tokens to buy the ${quantity}x ${
			item.name
		}. You need ${overallCost}, but you have only ${balance.toLocaleString()}.`;
	}

	await user.addItemsToBank({ items: new Bank().add(item.id, quantity), collectionLog: true });
	await user.update({
		dungeoneering_tokens: {
			decrement: overallCost
		}
	});

	return `Successfully purchased ${quantity}x ${item.name} for ${overallCost} Dungeoneering tokens.`;
}

function floorsCommand(user: MUser) {
	const lines = ['**Dungeoneering Floors:**\n'];
	for (const floor of allFloors) {
		const dgReq = determineDgLevelForFloor(floor);
		const cmbReq = requiredLevel(floor);
		const nonCmbReq = floorNonCombatLevels[floor] ?? 5;
		const canDo = hasRequiredLevels(user, floor);

		let line = `**Floor ${floor}:** ${canDo ? 'Unlocked' : 'Locked'}`;
		if (!canDo) {
			const missing = getMissingSkillsForFloor(user, floor);
			const missingStr = missing.map(m => `${m.required} ${m.skill} (${m.current})`).join(', ');
			line += ` - Missing: ${missingStr}`;
		}
		line += `\nRequirements: Level ${dgReq} Dungeoneering, ${cmbReq} in all combat stats, ${nonCmbReq} in all non-combat stats.`;
		lines.push(line);
	}
	return lines.join('\n');
}

async function statsCommand(user: MUser) {
	const floorCounts = await getDungeoneeringFloorCompletions(user);
	const totalFloors = Object.values(floorCounts).reduce((a, b) => a + b, 0);
	const maxFloor = calcMaxFloorUserCanDo(user);
	const tokens = user.user.dungeoneering_tokens;

	let str = `<:dungeoneeringToken:1560872995713458286> **Dungeoneering Tokens:** ${tokens.toLocaleString()}
**Total Floors Completed:** ${totalFloors}
**Max Floor:** ${maxFloor}`;

	if (maxFloor < 10) {
		const nextFloor = (maxFloor + 1) as Floor;
		const missing = getMissingSkillsForFloor(user, nextFloor);
		if (missing.length > 0) {
			const missingStr = missing.map(m => `${m.required} ${m.skill} (${m.current})`).join(', ');
			str += `\n**Next Floor (${nextFloor}) Missing:** ${missingStr}`;
		}
	}

	const currentRing = getCurrentKinshipTier(user);
	if (!currentRing) {
		str += '\n**Ring of Kinship:** None (Complete Floor 1 to unlock)';
	} else if (currentRing.tier === 5) {
		str += '\n**Ring of Kinship:** Overcharged (+10% speed, +5% XP & tokens)';
	} else {
		const dgLvl = user.skillsAsLevels.dungeoneering;
		const hasTokens = currentRing.reqTokens === 0 || tokens >= currentRing.reqTokens;
		const hasTotalFloors = totalFloors >= currentRing.reqFloors;
		const hasLvl = dgLvl >= currentRing.reqDgLevel;
		const hasOvercharger = currentRing.tier === 4 ? user.hasEquippedOrInBank('Kinship overcharger') : true;
		const spreadCheck = currentRing.floorSpreadReq
			? checkKinshipFloorSpread(floorCounts, currentRing.floorSpreadReq)
			: { hasSpread: true, missing: [] };

		str += `\n**Ring of Kinship:** ${currentRing.name} (+${currentRing.speedBoost}% speed)`;
		str += `\n**Next Tier:** ${currentRing.nextTierName}`;
		str += `\n- Total Floors: ${totalFloors}/${currentRing.reqFloors}`;
		if (currentRing.floorSpreadReq) {
			if (spreadCheck.hasSpread) {
				str += `\n- Floor Spread: Completed (${currentRing.floorSpreadReq.minCompletions}x on Floors 1-${currentRing.floorSpreadReq.maxFloor})`;
			} else {
				const missingStr = spreadCheck.missing.map(m => `F${m.floor}: ${m.current}/${m.required}`).join(', ');
				str += `\n- Floor Spread (${currentRing.floorSpreadReq.minCompletions}x on Floors 1-${currentRing.floorSpreadReq.maxFloor}): Missing ${missingStr}`;
			}
		}
		str += `\n- Dungeoneering Level: ${dgLvl}/${currentRing.reqDgLevel}`;
		if (currentRing.reqTokens > 0) {
			str += `\n- Tokens: ${tokens.toLocaleString()}/${currentRing.reqTokens.toLocaleString()}`;
		}
		if (currentRing.tier === 4) {
			str += `\n- Kinship overcharger: ${hasOvercharger ? 'Owned' : 'Missing (Buy from /dg buy)'}`;
		}

		if (hasTotalFloors && spreadCheck.hasSpread && hasLvl && hasTokens && hasOvercharger) {
			str += `\n**Ready to upgrade:** Use \`/create item: ${currentRing.nextTierName}\` (must be unequipped in bank)`;
		} else {
			str += `\n_Upgrade via \`/create item: ${currentRing.nextTierName}\` once requirements are met._`;
		}
	}

	const floorList = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
		.filter(f => (floorCounts[f] ?? 0) > 0 || f <= maxFloor)
		.map(f => `F${f}: ${floorCounts[f] ?? 0}`)
		.join(', ');
	if (floorList.length > 0) {
		str += `\n**Completions by Floor:** ${floorList}`;
	}

	const { boosts } = calcUserGorajanShardChance(user);
	if (boosts.length > 0) {
		str += `\n**Gorajan shard boosts:** ${boosts.join(', ')}`;
	}

	return str;
}

export const dgCommand = defineCommand({
	name: 'dg',
	description: 'The Dungeoneering skill.',
	attributes: {
		requiresMinion: true
	},
	options: [
		{
			type: 'Subcommand',
			name: 'start',
			description: 'Start a Dungeoneering trip.',
			options: [
				{
					type: 'String',
					name: 'floor',
					description: 'The floor you want to do. (Optional, defaults to max)',
					autocomplete: async ({ user }: StringAutoComplete) => {
						return [...allFloors].reverse().map(floor => {
							const canDo = hasRequiredLevels(user, floor);
							return {
								name: `Floor ${floor}${canDo ? '' : ' (Locked)'}`,
								value: floor.toString()
							};
						});
					},
					required: false
				},
				{
					type: 'Boolean',
					name: 'solo',
					description: 'Do you want to solo? (Optional)',
					required: false
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'stats',
			description: 'See your Dungeoneering stats and Ring of kinship progress.'
		},
		{
			type: 'Subcommand',
			name: 'floors',
			description: 'View requirements and unlock status for all Dungeoneering floors.'
		},
		{
			type: 'Subcommand',
			name: 'buy',
			description: 'Buy rewards with your Dungeoneering tokens.',
			options: [
				{
					type: 'String',
					name: 'item',
					description: 'The item you want to buy.',
					autocomplete: async ({ value }: StringAutoComplete) => {
						return dungBuyables
							.filter(i => (!value ? true : i.item.name.toLowerCase().includes(value.toLowerCase())))
							.map(i => ({ name: i.item.name, value: i.item.name }));
					},
					required: false
				},
				{
					type: 'Integer',
					name: 'quantity',
					description: 'The quantity you wish to buy.',
					required: false,
					min_value: 1
				}
			]
		}
	],
	run: async ({ options, user, channelId, interaction }) => {
		if (interaction) await interaction.defer();
		if (options.start) return startCommand(interaction, channelId, user, options.start.floor, options.start.solo);
		if (options.buy) return buyCommand(user, options.buy.item, options.buy.quantity);
		if (options.floors) return floorsCommand(user);
		return statsCommand(user);
	}
});

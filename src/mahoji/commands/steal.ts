import { bold } from '@oldschoolgg/discord';
import { formatDuration, reduceNumByPercent, stringMatches } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import { BitField } from '@/lib/constants.js';
import { QuestID, quests } from '@/lib/minions/data/quests.js';
import removeFoodFromUser from '@/lib/minions/functions/removeFoodFromUser.js';
import { Thieving } from '@/lib/skilling/skills/thieving/index.js';
import { type Stealable, stealables } from '@/lib/skilling/skills/thieving/stealables.js';
import type { PickpocketActivityTaskOptions } from '@/lib/types/minions.js';
import { determineRunes } from '@/lib/util/determineRunes.js';
import { formatTripDuration } from '@/lib/util/minionUtils.js';
import { calcLootXPPickpocketing } from '@/tasks/minions/pickpocketActivity.js';

export const stealCommand = defineCommand({
	name: 'steal',
	description: 'Sends your minion to steal to train Thieving.',
	attributes: {
		requiresMinion: true,
		requiresMinionNotBusy: true,
		examples: ['/steal name:Man']
	},
	options: [
		{
			type: 'String',
			name: 'name',
			description: 'The object you try to steal from.',
			required: true,
			autocomplete: async ({ value, user }: StringAutoComplete) => {
				const conLevel = user.skillLevel('thieving');
				return Thieving.stealables
					.filter(i => (!value ? true : i.name.toLowerCase().includes(value.toLowerCase())))
					.filter(c => c.level <= conLevel)
					.map(i => ({
						name: i.name,
						value: i.name
					}));
			}
		},
		{
			type: 'Integer',
			name: 'quantity',
			description: 'The quantity (defaults to max).',
			required: false,
			min_value: 1
		},
		{
			type: 'Boolean',
			name: 'shadow_veil',
			description: 'Use Shadow Veil while pickpocketing.',
			required: false
		}
	],
	run: async ({ options, user, channelId, rng }) => {
		const stealable: Stealable | undefined = stealables.find(
			obj =>
				stringMatches(obj.name, options.name) ||
				stringMatches(obj.id.toString(), options.name) ||
				obj.aliases?.some(alias => stringMatches(alias, options.name))
		);

		if (!stealable) {
			return `That is not a valid NPC/Stall to pickpocket or steal from, try pickpocketing or stealing from one of the following: ${stealables
				.map(obj => obj.name)
				.join(', ')}.`;
		}

		if (options.shadow_veil) {
			if (stealable.type !== 'pickpockable') {
				return 'Shadow Veil can only be used while pickpocketing.';
			}
			if (user.skillLevel('magic') < 47) {
				return 'You need 47 Magic to use Shadow Veil.';
			}
			if (!user.user.finished_quest_ids.includes(QuestID.AKingdomDivided)) {
				return 'You need to complete A Kingdom Divided to use Shadow Veil.';
			}
		}

		if (stealable.qpRequired && user.QP < stealable.qpRequired) {
			return `You need at least **${stealable.qpRequired}** QP to ${
				stealable.type === 'pickpockable' ? 'pickpocket' : 'steal from'
			} a ${stealable.name}.`;
		}

		if (stealable.requiredQuests) {
			const incompleteQuest = stealable.requiredQuests.find(
				quest => !user.user.finished_quest_ids.includes(quest)
			);
			if (incompleteQuest) {
				return `You need to have completed the ${bold(
					quests.find(i => i.id === incompleteQuest)!.name
				)} quest to steal from ${stealable.name}.`;
			}
		}

		if (stealable.fireCapeRequired) {
			if (user.cl.amount('Fire cape') === 0) {
				return `In order to ${
					stealable.type === 'pickpockable' ? 'pickpocket this NPC' : 'steal from this stall'
				}, you need a fire cape in your collection log.`;
			}
		}

		if (user.skillsAsLevels.thieving < stealable.level) {
			return `${user.minionName} needs ${stealable.level} Thieving to ${
				stealable.type === 'pickpockable' ? 'pickpocket' : 'steal from'
			} a ${stealable.name}.`;
		}

		let timeToTheft =
			stealable.type === 'pickpockable' ? (stealable.customTickRate ?? 2) * 600 : stealable.respawnTime;

		if (!timeToTheft) {
			Logging.logError(new Error('respawnTime missing from stealable object.'), {
				userID: user.id,
				stealable: stealable.name
			});
			return 'This NPC/Stall is missing variable respawnTime.';
		}

		const boosts = [];

		if (user.hasEquipped('Thieving master cape')) {
			timeToTheft = reduceNumByPercent(timeToTheft, 30);
			boosts.push('30% boost for Thieving master cape');
		}
		if (user.usingPet('Wilvus')) {
			timeToTheft = reduceNumByPercent(timeToTheft, 50);
			boosts.push('50% boost for Wilvus');
		}

		const maxTripLength =
			(stealable.name === 'Wealthy Citizen' ? 2 : 1) * (await user.calcMaxTripLength('Pickpocket'));

		let { quantity } = options;
		if (!quantity) quantity = Math.floor(maxTripLength / timeToTheft);

		const duration = quantity * timeToTheft;

		if (duration > maxTripLength) {
			return `${user.minionName} can't go on trips longer than ${formatDuration(
				maxTripLength
			)}, try a lower quantity. The highest amount of times you can ${
				stealable.type === 'pickpockable' ? 'pickpocket' : 'steal from'
			} a ${stealable.name} is ${Math.floor(maxTripLength / timeToTheft)}.`;
		}

		const shadowVeilCastInterval = Math.max(50, user.skillLevel('magic')) * 600;

		const shadowVeilCasts = options.shadow_veil ? Math.ceil(duration / shadowVeilCastInterval) : 0;

		let shadowVeilRuneCost = new Bank();

		if (shadowVeilCasts > 0) {
			shadowVeilRuneCost
				.add('Earth rune', shadowVeilCasts * 5)
				.add('Fire rune', shadowVeilCasts * 5)
				.add('Cosmic rune', shadowVeilCasts * 5);

			shadowVeilRuneCost = determineRunes(user, shadowVeilRuneCost);
			if (!user.owns(shadowVeilRuneCost)) {
				return `You need ${shadowVeilRuneCost} to use Shadow Veil for this trip.`;
			}
		}

		let successfulQuantity = 0;
		let xpReceived = 0;
		let damageTaken = 0;
		let dodgyNecklaceChargesUsed = 0;

		let str = `${user.minionName} is now going to ${
			stealable.type === 'pickpockable' ? 'pickpocket' : 'steal from'
		} a ${stealable.name} ${quantity}x times, it'll take around ${formatTripDuration(user, duration)} to finish.`;

		if (stealable.name === 'Black knight guard') {
			const godFavour = await user.getGodFavour();
			if (godFavour.Zamorak < 90) {
				return 'Zamorak does not bid you access to the Dark Temple, where the Black knight guards are.';
			}
		}

		if (stealable.type === 'pickpockable') {
			const hasArdyHard = user.hasDiary('ardougne.hard');
			if (hasArdyHard) {
				boosts.push('+10% chance of success from Ardougne Hard diary');
			}

			[successfulQuantity, damageTaken, xpReceived, , dodgyNecklaceChargesUsed] = calcLootXPPickpocketing(
				user.skillsAsLevels.thieving,
				stealable,
				quantity,
				user.hasEquipped(['Thieving cape', 'Thieving cape(t)']),
				hasArdyHard,
				user.hasEquippedOrInBank(["Thieves' armband"]),
				rng,
				user.bitfield.includes(BitField.DisableDodgyNecklace) ? 0 : user.user.dodgy_necklace_charges,
				options.shadow_veil ? user.skillLevel('magic') : 0
			);

			if (user.hasEquipped(['Thieving cape', 'Thieving cape(t)', 'Thieving master cape'])) {
				boosts.push('+10% chance of success from Thieving cape');
			}

			if (Thieving.rogueOutfitPercentBonus(user) > 0) {
				boosts.push(
					`${Thieving.rogueOutfitPercentBonus(user)}% chance of x2 loot due to rogue outfit equipped`
				);
			}

			const { foodRemoved } = await removeFoodFromUser({
				user,
				totalHealingNeeded: damageTaken,
				healPerAction: Math.ceil(damageTaken / quantity),
				activityName: 'Pickpocketing',
				attackStylesUsed: []
			});

			if (shadowVeilCasts > 0) {
				await user.removeItemsFromBank(shadowVeilRuneCost);
				str += ` Used ${shadowVeilRuneCost} for ${shadowVeilCasts} Shadow Veil casts.`;
			}
			if (dodgyNecklaceChargesUsed > 0) {
				await user.update({
					dodgy_necklace_charges: {
						decrement: dodgyNecklaceChargesUsed
					}
				});
			}

			await Promise.all([
				user.statsBankUpdate('steal_loot_bank', foodRemoved),
				ClientSettings.updateBankSetting(
					'economyStats_thievingCost',
					new Bank(foodRemoved).add(shadowVeilRuneCost)
				)
			]);
			str += ` Removed ${foodRemoved}.`;
		} else {
			// Up to 5% fail chance, random
			successfulQuantity = Math.floor((quantity * rng.randInt(95, 100)) / 100);
			xpReceived = successfulQuantity * stealable.xp;
		}

		await ActivityManager.startTrip<PickpocketActivityTaskOptions>({
			monsterID: stealable.id,
			userID: user.id,
			channelId,
			quantity,
			duration,
			type: 'Pickpocket',
			damageTaken,
			successfulQuantity,
			xpReceived,
			dodgyNecklaceChargesUsed,
			dodgyNecklaceChargesRemaining: user.user.dodgy_necklace_charges,
			shadowVeilCasts
		});

		if (boosts.length > 0) {
			str += `\n\n**Boosts:** ${boosts.join(', ')}.`;
		}

		return str;
	}
});

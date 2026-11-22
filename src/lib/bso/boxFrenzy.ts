import { MysteryBoxes } from '@/lib/bso/openables/tables.js';
import { pickRandomChallengeItems } from '@/lib/bso/util/challengeItems.js';
import { LampTable } from '@/lib/bso/xpLamps.js';

import { dateFm, time, userMention } from '@oldschoolgg/discord';
import { Emoji, PerkTier, stringMatches, Time } from '@oldschoolgg/toolkit';
import { randArrItem } from 'node-rng';
import { Bank } from 'oldschooljs';

import { Channel, globalConfig } from '@/lib/constants.js';
import { getESTMidnightAfterDays } from '@/lib/util/estTime.js';
import { makeBankImage } from '@/lib/util/makeBankImage.js';

const activeFrenzyChannels = new Set<string>();

function getBoxFrenzyTierConfig(perkTier: PerkTier): {
	itemCount: number;
	cooldownMs: number;
	maxWinsPerUser: number;
} | null {
	if (perkTier >= PerkTier.Eight) {
		return { itemCount: 15, cooldownMs: Time.Day * 7, maxWinsPerUser: 2 };
	}
	if (perkTier === PerkTier.Seven) {
		return { itemCount: 10, cooldownMs: Time.Day * 10, maxWinsPerUser: 2 };
	}
	if (perkTier === PerkTier.Six) {
		return { itemCount: 6, cooldownMs: Time.Day * 12, maxWinsPerUser: 1 };
	}
	return null;
}

export async function boxFrenzyCommand(user: MUser, interaction: MInteraction): CommandResponse {
	const perkTier = await user.fetchPerkTier();
	const config = getBoxFrenzyTierConfig(perkTier);
	if (!config && !user.isAdmin) {
		return 'You need to be a Tier 5 patron or higher to start a Box Frenzy.';
	}

	const { itemCount, cooldownMs, maxWinsPerUser } = config ?? {
		itemCount: 10,
		cooldownMs: Time.Day * 5,
		maxWinsPerUser: 2
	};

	const channelId = interaction.channelId;
	const allowedChannel = Channel.GeneralChannel;
	if (globalConfig.isProduction && channelId !== allowedChannel && channelId !== '1560885061572763749') {
		return "You can't start a Box Frenzy in this channel. You can only use it in <#1560885061572763749>.";
	}

	if (activeFrenzyChannels.has(channelId)) {
		return 'A Box Frenzy is already active in this channel.';
	}

	const lastUse = Number(user.user.last_box_frenzy_date ?? 0);
	const cooldownDays = Math.max(1, Math.round(cooldownMs / Time.Day));
	const nextAvailable = lastUse > 0 ? getESTMidnightAfterDays(cooldownDays, new Date(lastUse)) : null;
	if (nextAvailable && Date.now() < nextAvailable.getTime() && !user.isAdmin) {
		return `Your Box Frenzy is on cooldown until midnight EST (${dateFm(nextAvailable)}).`;
	}

	const pickedItems = pickRandomChallengeItems(itemCount, true);
	if (pickedItems.length === 0) {
		return 'Could not generate items for Box Frenzy.';
	}

	activeFrenzyChannels.add(channelId);

	try {
		await user.update({
			last_box_frenzy_date: Date.now()
		});

		const bank = new Bank();
		for (const item of pickedItems) {
			bank.add(item.id, 1);
		}

		const bonusItem = randArrItem(pickedItems)!;
		const clMask = new Bank();
		for (const item of pickedItems) {
			if (item.id !== bonusItem.id) {
				clMask.add(item.id, 1);
			}
		}

		const image = await makeBankImage({
			bank,
			title: 'Box Frenzy - Guess Item Names',
			user,
			previousCL: clMask,
			showNewCL: true
		});

		const durationMs = Time.Minute;
		const endTimestamp = Math.floor((Date.now() + durationMs) / 1000);

		await interaction.replyWithResponse({
			content: `${Emoji.MysteryBox} ${userMention(user.id)} started a **Box Frenzy** (${pickedItems.length} items, max ${maxWinsPerUser} win${maxWinsPerUser > 1 ? 's' : ''} per player)!
Reply directly to this message with item names from the image before ${time(endTimestamp, 'R')}. The outlined bonus item grants a bonus XP Lamp!`,
			files: [image],
			withResponse: true
		});

		const guessedIds = new Set<number>();
		const userWinCounts = new Map<string, number>();
		const winRecords: Array<{ userId: string; itemName: string; isBonus: boolean }> = [];

		await globalClient
			.awaitMessages({
				channelId,
				time: durationMs,
				max: 1,
				filter: msg => {
					if (msg.author.bot) return false;
					const currentWins = userWinCounts.get(msg.author.id) ?? 0;
					if (currentWins >= maxWinsPerUser) return false;

					const matched = pickedItems.find(
						item => !guessedIds.has(item.id) && stringMatches(item.name, msg.content)
					);
					if (!matched) return false;

					guessedIds.add(matched.id);
					userWinCounts.set(msg.author.id, currentWins + 1);
					winRecords.push({
						userId: msg.author.id,
						itemName: matched.name,
						isBonus: matched.id === bonusItem.id
					});

					return guessedIds.size >= pickedItems.length;
				}
			})
			.catch(() => null);

		const rewardLines: string[] = [];
		for (const record of winRecords) {
			const winner = await mUserFetch(record.userId);
			const loot = new Bank().add(MysteryBoxes.roll());
			if (record.isBonus) {
				loot.add(LampTable.roll());
			}
			await winner.addItemsToBank({ items: loot, collectionLog: false });
			rewardLines.push(
				`- ${userMention(record.userId)} guessed **${record.itemName}**${record.isBonus ? ' (Bonus)' : ''} and won **${loot}**`
			);
		}

		const unguessed = pickedItems.filter(i => !guessedIds.has(i.id)).map(i => i.name);
		const summaryLines = [`**Box Frenzy Finished!** (${winRecords.length}/${pickedItems.length} items guessed)`];
		if (rewardLines.length > 0) {
			summaryLines.push(...rewardLines);
		} else {
			summaryLines.push('Nobody guessed any items in time.');
		}
		if (unguessed.length > 0) {
			summaryLines.push(`**Unguessed items:** ${unguessed.join(', ')}`);
		}

		return summaryLines.join('\n');
	} finally {
		activeFrenzyChannels.delete(channelId);
	}
}

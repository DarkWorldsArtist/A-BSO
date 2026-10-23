import { formatDuration, Time } from '@oldschoolgg/toolkit';

import { applyPatronTimeGrant, calculatePatronTimeGrant, fetchPatronTimeBalance } from '@/lib/patronTime.js';
import { Bits, patronTiers } from '@/util.js';

const tier4PlusBits = [Bits.PatronTier4, Bits.PatronTier5, Bits.PatronTier6, Bits.PatronTier7] as const;
const tier5PlusBits = [Bits.PatronTier5, Bits.PatronTier6, Bits.PatronTier7] as const;

function hasCurrentMonthGift(lastGift: bigint | null, now = Date.now()) {
	if (lastGift === null) return false;
	const giftDate = new Date(Number(lastGift));
	const nowDate = new Date(now);
	return giftDate.getUTCFullYear() === nowDate.getUTCFullYear() && giftDate.getUTCMonth() === nowDate.getUTCMonth();
}

function getGiftTier(bits: readonly number[]) {
	if (tier5PlusBits.some(bit => bits.includes(bit))) {
		return patronTiers.find(tier => tier.number === 3) ?? null;
	}
	if (tier4PlusBits.some(bit => bits.includes(bit))) {
		return patronTiers.find(tier => tier.number === 2) ?? null;
	}
	return null;
}

export const perksCommand = defineCommand({
	name: 'perks',
	description: 'Perk commands.',
	options: [
		{
			type: 'Subcommand',
			name: 'donate_tier',
			description: 'Donate temporary patron time to a user.',
			options: [
				{
					type: 'User',
					name: 'user',
					description: 'The user to donate patron time to.',
					required: true
				}
			]
		}
	],
	run: async ({ options, user, interaction }) => {
		if (options.donate_tier) {
			const donor = await roboChimpClient.user.findUniqueOrThrow({
				where: {
					id: user.id
				},
				select: {
					bits: true,
					last_patreon_gift: true
				}
			});
			const giftTier = getGiftTier(donor.bits);

			if (!giftTier) {
				return 'You need Tier 4 or higher to donate patron time.';
			}

			if (hasCurrentMonthGift(donor.last_patreon_gift)) {
				return 'You have already donated patron time this month. You can donate again on the 1st of next month.';
			}

			const targetUser = await globalClient.fetchRUser(options.donate_tier.user.user.id);
			const now = Date.now();
			const currentBalance = await fetchPatronTimeBalance(targetUser.id);
			const grant = calculatePatronTimeGrant({
				currentBalance,
				timeMs: Time.Week,
				tier: giftTier.perkTier,
				now
			});

			await interaction.confirmation(
				`Donate 1 week of Tier ${giftTier.number} patron to ${targetUser.mention}? This uses your monthly Patreon gift.`
			);

			await roboChimpClient.$transaction(async tx => {
				await applyPatronTimeGrant({
					client: tx,
					userID: targetUser.id,
					grant
				});
				await tx.user.update({
					where: {
						id: user.id
					},
					data: {
						last_patreon_gift: now
					}
				});
			});

			await Promise.all([globalClient.fetchRUser(targetUser.id), globalClient.fetchRUser(user.id)]);

			return `Donated 1 week of Tier ${giftTier.number} patron to ${targetUser.mention}. They have ${formatDuration(
				grant.remainingTime
			)} remaining.`;
		}

		return 'Invalid command.';
	}
});

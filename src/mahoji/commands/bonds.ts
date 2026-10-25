import { getBondStatusForUser, giftUserBonds, redeemUserBonds } from '@/lib/bonds.js';

export const bondsCommand = defineCommand({
	name: 'bonds',
	description: 'View, redeem, or gift patron bonds earned from playtime.',
	options: [
		{
			type: 'Subcommand',
			name: 'status',
			description: 'View your bond balance and playtime progress toward the next bond.'
		},
		{
			type: 'Subcommand',
			name: 'redeem',
			description: 'Redeem bond(s) for 7 days of Tier 3 Patron each.',
			options: [
				{
					type: 'Integer',
					name: 'quantity',
					description: 'The number of bonds to redeem (defaults to 1).',
					required: false,
					min_value: 1,
					max_value: 52
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'gift',
			description: 'Gift earned bond(s) to another user.',
			options: [
				{
					type: 'User',
					name: 'user',
					description: 'The user to gift bond(s) to.',
					required: true
				},
				{
					type: 'Integer',
					name: 'quantity',
					description: 'The number of bonds to gift (defaults to 1).',
					required: false,
					min_value: 1,
					max_value: 20
				}
			]
		}
	],
	run: async ({ options, user, interaction }) => {
		if (options.status) {
			return getBondStatusForUser(user);
		}

		if (options.redeem) {
			const qty = options.redeem.quantity ?? 1;
			return redeemUserBonds(user, qty, interaction);
		}

		if (options.gift) {
			const recipient = await mUserFetch(options.gift.user.user.id);
			const qty = options.gift.quantity ?? 1;
			return giftUserBonds(user, recipient, qty, interaction);
		}

		return getBondStatusForUser(user);
	}
});

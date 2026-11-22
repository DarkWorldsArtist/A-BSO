import { patronPartyRoomCommand, playerPartyRoomCommand } from '@/lib/bso/partyRoom.js';

import { baseFilters, filterableTypes } from '@/lib/data/filterables.js';

export const partyRoomCommand = defineCommand({
	name: 'partyroom',
	flags: ['REQUIRES_LOCK'],
	description: 'Host a Falador Party Room balloon drop party.',
	attributes: {
		requiresMinion: true,
		examples: ['/partyroom drop items:10m, 5 twisted bow', '/partyroom patron']
	},
	options: [
		{
			type: 'Subcommand',
			name: 'drop',
			description: 'Host a player-funded Falador Party Room drop party using items or GP from your bank.',
			options: [
				{
					type: 'String',
					name: 'items',
					description: 'The items or GP from your bank to put into the Party Room chest.',
					required: false
				},
				{
					type: 'String',
					name: 'filter',
					description: 'The filter you want to use.',
					required: false,
					autocomplete: async ({ value }: StringAutoComplete) => {
						const res = !value
							? filterableTypes
							: [...filterableTypes].filter(filter =>
									filter.name.toLowerCase().includes(value.toLowerCase())
								);
						return [...res]
							.sort((a, b) => baseFilters.indexOf(b) - baseFilters.indexOf(a))
							.map(val => ({ name: val.name, value: val.aliases[0] ?? val.name }));
					}
				},
				{
					type: 'String',
					name: 'search',
					description: 'A search query for items in your bank to drop.',
					required: false
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'patron',
			description: 'Patron T4+: Trigger a bot-funded Falador Party Room drop party.',
			options: []
		}
	],
	run: async ({ options, user, interaction, channelId, guildId }): CommandResponse => {
		await interaction.defer();
		if (options.patron) {
			return patronPartyRoomCommand(user, interaction);
		}
		if (options.drop) {
			return playerPartyRoomCommand({
				user,
				interaction,
				channelId,
				guildId,
				itemsInput: options.drop.items,
				search: options.drop.search,
				filter: options.drop.filter
			});
		}
		return 'Invalid Party Room command.';
	}
});

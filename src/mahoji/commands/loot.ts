import { getAllTrackedLootForUser, getDetailsOfSingleTrackedLoot } from '@/lib/lootTrack.js';

export const lootCommand = defineCommand({
	name: 'loot',
	description: 'View your loot tracker data.',
	attributes: {
		examples: ['/loot view name:Nex']
	},
	options: [
		{
			type: 'Subcommand',
			name: 'view',
			description: 'View your tracked loot for a certain thing.',
			options: [
				{
					type: 'String',
					name: 'name',
					description: 'The thing you want to view.',
					required: true,
					autocomplete: async ({ value, userId }: StringAutoComplete) => {
						return (await getAllTrackedLootForUser(userId))
							.filter(i => (!value ? true : i.key.toLowerCase().includes(value.toLowerCase())))
							.map(i => ({
								name: i.key,
								value: i.id
							}));
					}
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'reset',
			description: 'Reset one of your loot trackers.',
			options: [
				{
					type: 'String',
					name: 'name',
					description: 'The thing you want to reset.',
					required: true,
					autocomplete: async ({ value, userId }: StringAutoComplete) => {
						return (await getAllTrackedLootForUser(userId))
							.filter(i => (!value ? true : i.key.toLowerCase().includes(value.toLowerCase())))
							.map(i => ({
								name: i.key,
								value: i.id
							}));
					}
				}
			]
		}
	],
	run: async ({ options, user, interaction }) => {
		const name = options.view?.name ?? options.reset?.name ?? '';

		const trackedLoot = await prisma.lootTrack
			.findFirst({
				where: {
					id: name,
					user_id: BigInt(user.id)
				}
			})
			.catch(() => null);
		if (!trackedLoot) {
			return "The name you specified doesn't exist.";
		}

		if (options.view) {
			return getDetailsOfSingleTrackedLoot(user, trackedLoot);
		}
		if (options.reset) {
			await interaction.confirmation('Are you sure you want to reset this loot tracker?');
			await prisma.lootTrack.delete({
				where: {
					id: trackedLoot.id
				}
			});
			const current = await getDetailsOfSingleTrackedLoot(user, trackedLoot);
			current.content = `**You reset this loot tracker:\n\n${current.content}`;
			return current;
		}

		return 'Invalid command.';
	}
});

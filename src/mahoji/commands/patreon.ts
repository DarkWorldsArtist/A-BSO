import { SUPPORT_PROJECT_MSG } from '@/lib/constants.js';

export const patreonCommand = defineCommand({
	name: 'patreon',
	description: 'Shows the patreon link for the bot, where you can donate.',
	options: [],
	run: async () => {
		return SUPPORT_PROJECT_MSG;
	}
});

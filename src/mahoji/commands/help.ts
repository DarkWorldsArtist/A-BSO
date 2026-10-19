import { SUPPORT_PROJECT_MSG } from '@/lib/constants.js';
import { mahojiInformationalButtons } from '@/lib/sharedComponents.js';

export const helpCommand = defineCommand({
	name: 'help',
	description: 'Get information and help with the bot.',
	options: [],
	run: async () => {
		return {
			content: `🧑‍⚖️ **Rules:** You must follow the server's simple rules, breaking any rule can result in a permanent ban - and "I didn't know the rules" is not a valid excuse, read them here: <#1529773213922627584>

<:patreonLogo:1560872629345325067> **Patreon:** ${SUPPORT_PROJECT_MSG} ❤️

📢 **News:** Follow <#346210791747223554> for updates and news about the bot.
☺️ **Support:** <#668073484731154462> and <#970752140324790384>

Please click the buttons below for important links.`,
			components: mahojiInformationalButtons
		};
	}
});

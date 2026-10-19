import { isAtleastThisOld, Time } from '@oldschoolgg/toolkit';
import { DiscordSnowflake } from '@sapphire/snowflake';
import { Bank } from 'oldschooljs';

import { SUPPORT_PROJECT_MSG } from '@/lib/constants.js';
import { mahojiInformationalButtons } from '@/lib/sharedComponents.js';
import { fetchUserStats } from '@/lib/util/fetchUserStats.js';

export async function minionBuyCommand(user: MUser, ironman: boolean): CommandResponse {
	if (user.hasMinion) return 'You already have a minion!';

	await user.update({
		minion_hasBought: true,
		minion_bought_date: new Date(),
		minion_ironman: Boolean(ironman)
	});

	const createdAt = DiscordSnowflake.timestampFrom(user.id);
	const starter = isAtleastThisOld(createdAt, Time.Year * 2)
		? new Bank({
				Shark: 300,
				'Saradomin brew(4)': 50,
				'Super restore(4)': 20,
				'Anti-dragon shield': 1,
				'Tiny lamp': 5,
				'Small lamp': 2,
				'Tradeable mystery box': 5,
				'Untradeable Mystery box': 5,
				'Dragon bones': 50,
				Coins: 50_000_000,
				'Clue scroll (beginner)': 10,
				'Equippable mystery box': 1,
				'Pet Mystery box': 1
			})
		: null;

	if (starter) {
		await user.addItemsToBank({ items: starter, collectionLog: false });
	}
	// Ensure user has a userStats row
	await fetchUserStats(user.id);

	return {
		content: `You have successfully got yourself a minion, and you're ready to use the bot now! Please check out the links below for information you should read.

<:ironman:1560872575205117962> You can make your new minion an Ironman by using the command: \`/minion ironman\`.

🧑‍⚖️ **Rules:** You must follow the server's simple rules, breaking any rule can result in a permanent ban - and "I didn't know the rules" is not a valid excuse, read them here: <#1529773213922627584>

<:patreonLogo:1560872629345325067> **Patreon:** ${SUPPORT_PROJECT_MSG} ❤️

Please click the buttons below for important links.

${starter !== null ? `**You received these starter items:** ${starter}.` : ''}`,
		components: mahojiInformationalButtons
	};
}

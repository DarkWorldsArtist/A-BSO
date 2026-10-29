import '../src/lib/safeglobals.js';

import { REST } from '@discordjs/rest';
import { type APIGuild, Routes } from '@oldschoolgg/discord';

import { convertCommandToAPICommand } from '@/discord/index.js';
import { allCommandsDONTIMPORT } from '@/mahoji/commands/allCommands.js';

async function main() {
	const token = process.env.BOT_TOKEN;
	const clientId = process.env.CLIENT_ID;

	if (!token || !clientId) {
		console.error('Missing BOT_TOKEN or CLIENT_ID in environment variables.');
		process.exit(1);
	}

	const rest = new REST({ version: '10' }).setToken(token);

	console.log(`Preparing commands... Found ${allCommandsDONTIMPORT.length} commands.`);
	const body = allCommandsDONTIMPORT.map(convertCommandToAPICommand);

	const targetGuilds = new Set<string>();

	if (process.env.TESTING_SERVER) targetGuilds.add(process.env.TESTING_SERVER.trim());
	if (process.env.TESTING_SERVER_ID) targetGuilds.add(process.env.TESTING_SERVER_ID.trim());
	if (process.env.SUPPORT_SERVER_ID) targetGuilds.add(process.env.SUPPORT_SERVER_ID.trim());
	if (process.env.TESTING_SERVER_IDS) {
		for (const id of process.env.TESTING_SERVER_IDS.split(',')) {
			const trimmed = id.trim();
			if (trimmed) targetGuilds.add(trimmed);
		}
	}

	// Also fetch guilds the bot is currently in from Discord API
	try {
		const guilds = (await rest.get(Routes.userGuilds())) as APIGuild[];
		console.log(`Bot is in ${guilds.length} guild(s): ${guilds.map(g => `${g.name} (${g.id})`).join(', ')}`);
		for (const guild of guilds) {
			targetGuilds.add(guild.id);
		}
	} catch (err) {
		console.warn('Failed to fetch bot guilds from Discord API:', err);
	}

	if (targetGuilds.size === 0) {
		console.error('No target guilds found to deploy commands to.');
		process.exit(1);
	}

	console.log(`Deploying ${body.length} commands to ${targetGuilds.size} guild(s)...`);

	for (const guildId of targetGuilds) {
		try {
			console.log(`Deploying commands to guild ${guildId}...`);
			await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
			console.log(`Successfully deployed ${body.length} commands to guild ${guildId}!`);
		} catch (err) {
			console.error(`Failed to deploy commands to guild ${guildId}:`, err);
		}
	}

	if (process.argv.includes('--global')) {
		console.log('Deploying commands globally...');
		try {
			await rest.put(Routes.applicationCommands(clientId), { body });
			console.log(`Successfully deployed ${body.length} commands globally!`);
		} catch (err) {
			console.error('Failed to deploy commands globally:', err);
		}
	}

	console.log('Finished deploying commands!');
}

main().catch(err => {
	console.error('Unhandled error during command deployment:', err);
	process.exit(1);
});

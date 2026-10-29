import {
	ApplicationCommandType,
	PermissionFlags,
	type RESTPostAPIApplicationGuildCommandsJSONBody,
	Routes
} from '@oldschoolgg/discord';

import { convertCommandOptionToAPIOption } from '@/discord/index.js';
import { globalConfig } from '@/lib/constants.js';

export async function resolveBotSendableMessage(rawMessage: SendableMessage): Promise<BaseSendableMessage> {
	if (typeof rawMessage === 'string') {
		return { content: rawMessage };
	}
	if ('build' in rawMessage) {
		return resolveBotSendableMessage(await rawMessage.build());
	}
	return rawMessage;
}

export function mentionCommand(name: string, subCommand?: string, subSubCommand?: string) {
	if (process.env.TEST) return '';
	const command = globalClient.allCommands.find(i => i.name === name);
	if (!command) {
		throw new Error(`Command ${name} not found`);
	}
	if (subCommand && !command.options.some(i => i.name === subCommand)) {
		throw new Error(`Command ${name} does not have subcommand ${subCommand}`);
	}

	const apiCommand = globalClient.applicationCommands!.find(i => i.name === name);
	if (!apiCommand) {
		throw new Error(`API Command ${name} not found`);
	}

	if (subCommand) {
		return `</${name} ${subCommand}${subSubCommand ? ` ${subSubCommand}` : ''}:${apiCommand.id}>`;
	}

	return `</${name}:${apiCommand.id}>`;
}

export function convertCommandToAPICommand(
	cmd: AnyCommand
): RESTPostAPIApplicationGuildCommandsJSONBody & { description: string } {
	const defaultMemberPermissions =
		cmd.defaultMemberPermissions !== undefined
			? String(cmd.defaultMemberPermissions)
			: cmd.requiredPermissions && cmd.requiredPermissions.length > 0
				? cmd.requiredPermissions.reduce((acc, p) => acc | PermissionFlags[p], 0n).toString()
				: undefined;

	return {
		type: ApplicationCommandType.ChatInput,
		name: cmd.name,
		description: cmd.description,
		options: cmd.options.map(convertCommandOptionToAPIOption),
		...(defaultMemberPermissions !== undefined ? { default_member_permissions: defaultMemberPermissions } : {})
	};
}

export async function bulkUpdateCommands() {
	if (!globalConfig.isProduction) {
		const body = globalClient.allCommands.map(convertCommandToAPICommand);
		const targetGuilds = new Set<string>();
		if (globalConfig.supportServerID) targetGuilds.add(globalConfig.supportServerID);
		if (process.env.TESTING_SERVER) targetGuilds.add(process.env.TESTING_SERVER);
		if (process.env.TESTING_SERVER_ID) targetGuilds.add(process.env.TESTING_SERVER_ID);
		if (process.env.SUPPORT_SERVER_ID) targetGuilds.add(process.env.SUPPORT_SERVER_ID);
		if (process.env.TESTING_SERVER_IDS) {
			for (const id of process.env.TESTING_SERVER_IDS.split(',')) {
				const trimmed = id.trim();
				if (trimmed) targetGuilds.add(trimmed);
			}
		}

		return Promise.all(
			Array.from(targetGuilds).map(async guildId => {
				try {
					await globalClient.rest.put(Routes.applicationGuildCommands(globalClient.applicationId, guildId), {
						body
					});
				} catch (err) {
					Logging.logError(err as Error, { msg: `Failed to sync slash commands with guild ${guildId}` });
				}
			})
		);
	}

	// Sync commands globally
	const globalCommands = globalClient.allCommands.filter(i => !i.guildId).map(convertCommandToAPICommand);
	const guildCommands = globalClient.allCommands.filter(i => Boolean(i.guildId)).map(convertCommandToAPICommand);

	return Promise.all([
		globalClient.rest.put(Routes.applicationCommands(globalClient.applicationId), { body: globalCommands }),
		globalClient.rest.put(
			Routes.applicationGuildCommands(globalClient.applicationId, globalConfig.supportServerID),
			{
				body: guildCommands
			}
		)
	]);
}

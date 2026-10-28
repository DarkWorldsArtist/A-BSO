import { ApplicationCommandType, InteractionType } from '@oldschoolgg/discord';
import type { IChatInputCommandInteraction } from '@oldschoolgg/schemas';
import { DiscordSnowflake } from '@sapphire/snowflake';
import { Items } from 'oldschooljs';

import { type Activity, activity_type_enum, type QueuedTrip } from '@/prisma/main.js';
import { ClueTiers } from '@/lib/clues/clueTiers.js';
import { globalConfig, PerkTier } from '@/lib/constants.js';
import killableMonsters from '@/lib/minions/data/killableMonsters/index.js';
import { OSInteraction } from '@/lib/structures/OSInteraction.js';
import { repeatTrip, taskCanBeRepeated } from '@/lib/util/repeatStoredTrip.js';

export const DAILY_QUEUE_CAP = 4;

export function describeActivity(activity: { type: activity_type_enum; data?: any }): string {
	const data = (activity.data ?? {}) as Record<string, any>;
	switch (activity.type) {
		case activity_type_enum.MonsterKilling: {
			const mon = killableMonsters.find(m => m.id === (data.mi ?? data.monsterID));
			const qty = data.q ?? data.quantity ?? 1;
			const wildyStr = data.isInWilderness ? ' (Wilderness)' : '';
			return mon
				? `${mon.name} (${qty}x)${wildyStr}`
				: data.isInWilderness
					? 'Monster Killing (Wilderness)'
					: 'Monster Killing';
		}
		case activity_type_enum.Woodcutting: {
			const log = data.logID ? Items.getItem(data.logID) : null;
			return log ? `${log.name} Woodcutting` : 'Woodcutting';
		}
		case activity_type_enum.Mining: {
			const ore = data.oreID ? Items.getItem(data.oreID) : null;
			return ore ? `${ore.name} Mining` : 'Mining';
		}
		case activity_type_enum.Fishing: {
			const fish = data.fishID ? Items.getItem(data.fishID) : null;
			return fish ? `${fish.name} Fishing` : data.fishName ? `${data.fishName} Fishing` : 'Fishing';
		}
		case activity_type_enum.ClueCompletion: {
			const clue = ClueTiers.find(c => c.id === (data.ci ?? data.clueID));
			return clue ? `${clue.name} Clues` : 'Clue Scrolls';
		}
		case activity_type_enum.Crafting: {
			const item = data.itemID ? Items.getItem(data.itemID) : null;
			return item ? `${item.name} Crafting` : 'Crafting';
		}
		case activity_type_enum.Smithing: {
			const bar = data.smithedBarID ? Items.getItem(data.smithedBarID) : null;
			return bar ? `${bar.name} Smithing` : 'Smithing';
		}
		case activity_type_enum.Smelting: {
			const bar = data.barID ? Items.getItem(data.barID) : null;
			return bar ? `${bar.name} Smelting` : 'Smelting';
		}
		case activity_type_enum.Cooking: {
			const food = data.cookableID ? Items.getItem(data.cookableID) : null;
			return food ? `${food.name} Cooking` : 'Cooking';
		}
		case activity_type_enum.Firemaking: {
			const log = data.burnableID ? Items.getItem(data.burnableID) : null;
			return log ? `${log.name} Firemaking` : 'Firemaking';
		}
		case activity_type_enum.Herblore: {
			const item = data.mixableID ? Items.getItem(data.mixableID) : null;
			return item ? `${item.name} Herblore` : 'Herblore';
		}
		case activity_type_enum.Fletching: {
			const item = data.fletchableName
				? Items.getItem(data.fletchableName)
				: data.fletchableID
					? Items.getItem(data.fletchableID)
					: null;
			return item ? `${item.name} Fletching` : 'Fletching';
		}
		case activity_type_enum.Alching: {
			const item = data.itemID ? Items.getItem(data.itemID) : null;
			return item ? `${item.name} Alching` : 'Alching';
		}
		case activity_type_enum.Runecraft: {
			const rune = data.runeID ? Items.getItem(data.runeID) : null;
			return rune ? `${rune.name} Runecrafting` : 'Runecrafting';
		}
		case activity_type_enum.Raids:
			return 'Chambers of Xeric';
		case activity_type_enum.TheatreOfBlood:
			return 'Theatre of Blood';
		case activity_type_enum.TombsOfAmascut:
			return 'Tombs of Amascut';
		case activity_type_enum.Colosseum:
			return 'Fortis Colosseum';
		case activity_type_enum.Inferno:
			return 'Inferno';
		case activity_type_enum.FightCaves:
			return 'Fight Caves';
		case activity_type_enum.Gauntlet:
			return data.corrupted ? 'Corrupted Gauntlet' : 'The Gauntlet';
		case activity_type_enum.Wintertodt:
			return 'Wintertodt';
		case activity_type_enum.Tempoross:
			return 'Tempoross';
		case activity_type_enum.Zalcano:
			return 'Zalcano';
		case activity_type_enum.Nex:
			return 'Nex';
		case activity_type_enum.Nightmare:
			return data.isSanctuary ? 'Ash Sanctuary' : 'The Nightmare';
		case activity_type_enum.Questing:
			return 'Questing';
		default:
			return activity.type;
	}
}

export function getMaxQueueDepth(perkTier: PerkTier): number {
	if (perkTier >= PerkTier.Six) return 4;
	if (perkTier === PerkTier.Five) return 2;
	if (perkTier === PerkTier.Four) return 1;
	return 0;
}

export function getESTDateKey(date: Date = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(date);
}

export function getDailyQueuedTripsUsed(user: MUser): number {
	const today = getESTDateKey();
	if (user.user.queued_trips_daily_date !== today) {
		return 0;
	}
	return user.user.queued_trips_daily_count;
}

export function getDailyQueuedTripsRemaining(user: MUser): number {
	return Math.max(0, DAILY_QUEUE_CAP - getDailyQueuedTripsUsed(user));
}

export function createSyntheticInteraction({
	user,
	channelId,
	guildId
}: {
	user: MUser;
	channelId: string;
	guildId?: string | null;
}): OSInteraction {
	const id = DiscordSnowflake.generate().toString();
	const chatInputItx: any = {
		id,
		token: 'synthetic-token',
		application_id: globalConfig.clientID,
		type: InteractionType.ApplicationCommand,
		data: {
			id,
			name: 'queue',
			type: ApplicationCommandType.ChatInput,
			options: []
		},
		channel: { id: channelId },
		channel_id: channelId,
		guild_id: guildId ?? null,
		user: { id: user.id }
	};
	const d: IChatInputCommandInteraction = {
		id,
		token: 'synthetic-token',
		user_id: user.id,
		created_timestamp: Date.now(),
		guild_id: guildId ?? null,
		channel_id: channelId,
		kind: 'ChatInputCommand',
		command_name: 'queue',
		command_type: ApplicationCommandType.ChatInput
	};
	return new OSInteraction({
		interaction: d,
		rawInteraction: chatInputItx,
		client: globalClient,
		user
	});
}

export async function queueTrip({
	user,
	activity,
	channelId
}: {
	user: MUser;
	activity: Activity;
	channelId: string;
}): Promise<string> {
	const perkTier = await user.fetchPerkTier();
	const maxDepth = getMaxQueueDepth(perkTier);
	if (maxDepth === 0) {
		return 'Trip queuing is a patron perk (Tier 4: 1 trip, Tier 5: 2 trips, Tier 6+: 4 trips).';
	}

	if (!taskCanBeRepeated(activity)) {
		return 'This activity cannot be queued.';
	}

	const currentQueue = await prisma.queuedTrip.findMany({
		where: { user_id: user.id },
		orderBy: { created_at: 'asc' }
	});

	if (currentQueue.length >= maxDepth) {
		return `Your trip queue is currently full (${currentQueue.length}/${maxDepth} trips). Your patron tier allows up to ${maxDepth} queued trips at a time.`;
	}

	const remainingToday = getDailyQueuedTripsRemaining(user);
	if (remainingToday <= 0) {
		return `You have already used all ${DAILY_QUEUE_CAP} queued trips for today. The daily cap resets at midnight EST.`;
	}

	await prisma.queuedTrip.create({
		data: {
			user_id: user.id,
			activity_id: activity.id && activity.id > 0 ? activity.id : null,
			activity_type: activity.type,
			data: activity.data as any,
			channel_id: activity.channel_id ?? BigInt(channelId)
		}
	});

	const newQueueCount = currentQueue.length + 1;
	const desc = describeActivity(activity);
	return `Added **${desc}** to your trip queue! (${newQueueCount}/${maxDepth} in queue, ${remainingToday} daily queued trips remaining today).`;
}

export async function processNextQueuedTrip(userID: string, channelId: string): Promise<void> {
	const user = await mUserFetch(userID);
	const perkTier = await user.fetchPerkTier();
	if (perkTier < PerkTier.Four) return;

	if (await user.minionIsBusy()) return;

	const nextTrip = await prisma.queuedTrip.findFirst({
		where: { user_id: userID },
		orderBy: { created_at: 'asc' }
	});
	if (!nextTrip) return;

	const today = getESTDateKey();
	const dailyUsed = getDailyQueuedTripsUsed(user);
	const targetChannel = nextTrip.channel_id ? nextTrip.channel_id.toString() : channelId;

	if (dailyUsed >= DAILY_QUEUE_CAP) {
		await globalClient.sendMessageOrWebhook(targetChannel, {
			content: `<@${userID}>, you have reached your daily limit of ${DAILY_QUEUE_CAP} queued trips for today (resets at midnight EST). Your remaining queued trips will wait until tomorrow.`
		});
		return;
	}

	await prisma.queuedTrip.delete({ where: { id: nextTrip.id } });

	let duration = (nextTrip.data as any)?.duration ?? 0;
	if (nextTrip.activity_id) {
		const originalActivity = await prisma.activity.findUnique({
			where: { id: nextTrip.activity_id },
			select: { duration: true }
		});
		if (originalActivity) {
			duration = originalActivity.duration;
		}
	}

	const activityObj: Activity = {
		id: nextTrip.activity_id ?? 0,
		user_id: BigInt(userID),
		start_date: new Date(),
		finish_date: new Date(),
		duration,
		completed: true,
		group_activity: false,
		type: nextTrip.activity_type,
		channel_id: nextTrip.channel_id,
		data: nextTrip.data,
		all_user_ids: [BigInt(userID)]
	};

	const interaction = createSyntheticInteraction({
		user,
		channelId: targetChannel
	});

	try {
		const response = await repeatTrip(user, interaction, activityObj);
		const isBusyNow = await user.minionIsBusy();

		if (isBusyNow) {
			const currentDailyCount =
				user.user.queued_trips_daily_date === today ? user.user.queued_trips_daily_count : 0;
			const newCount = currentDailyCount + 1;
			await prisma.user.update({
				where: { id: userID },
				data: {
					queued_trips_daily_date: today,
					queued_trips_daily_count: newCount
				}
			});

			const desc = describeActivity({ type: nextTrip.activity_type, data: nextTrip.data });
			let messageContent = '';
			if (typeof response === 'string') {
				messageContent = response;
			} else if (
				typeof response === 'object' &&
				response !== null &&
				'content' in response &&
				typeof (response as any).content === 'string'
			) {
				messageContent = (response as any).content;
			} else {
				messageContent = `${user.minionName} has started a queued trip: ${desc}!`;
			}

			await globalClient.sendMessageOrWebhook(targetChannel, {
				content: `**[Queued Trip ${newCount}/${DAILY_QUEUE_CAP} Today]**\n${messageContent}`
			});
		} else {
			const desc = describeActivity({ type: nextTrip.activity_type, data: nextTrip.data });
			let failReason = 'Insufficient supplies or requirements.';
			if (typeof response === 'string') {
				failReason = response;
			} else if (
				typeof response === 'object' &&
				response !== null &&
				'content' in response &&
				typeof (response as any).content === 'string'
			) {
				failReason = (response as any).content;
			}
			await globalClient.sendMessageOrWebhook(targetChannel, {
				content: `<@${userID}>, your queued trip (**${desc}**) could not be started: ${failReason}\nIt has been removed from your queue. Your daily queued trip allowance was not consumed.`
			});
		}
	} catch (err: any) {
		const desc = describeActivity({ type: nextTrip.activity_type, data: nextTrip.data });
		Logging.logError(err);
		await globalClient.sendMessageOrWebhook(targetChannel, {
			content: `<@${userID}>, an error occurred while launching your queued trip (**${desc}**): ${err?.message ?? err}\nIt has been removed from your queue. Your daily queued trip allowance was not consumed.`
		});
	}
}

export async function getQueueStatus(user: MUser): Promise<{
	trips: QueuedTrip[];
	depthLimit: number;
	dailyUsed: number;
	dailyRemaining: number;
}> {
	const perkTier = await user.fetchPerkTier();
	const depthLimit = getMaxQueueDepth(perkTier);
	const trips = await prisma.queuedTrip.findMany({
		where: { user_id: user.id },
		orderBy: { created_at: 'asc' }
	});
	const dailyUsed = getDailyQueuedTripsUsed(user);
	const dailyRemaining = getDailyQueuedTripsRemaining(user);
	return { trips, depthLimit, dailyUsed, dailyRemaining };
}

export async function clearQueue(user: MUser): Promise<number> {
	const res = await prisma.queuedTrip.deleteMany({
		where: { user_id: user.id }
	});
	return res.count;
}

export async function removeQueuedTrip(user: MUser, index: number): Promise<QueuedTrip | null> {
	const trips = await prisma.queuedTrip.findMany({
		where: { user_id: user.id },
		orderBy: { created_at: 'asc' }
	});
	const target = trips[index];
	if (!target) return null;
	await prisma.queuedTrip.delete({ where: { id: target.id } });
	return target;
}

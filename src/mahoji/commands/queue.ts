import { formatDuration } from '@oldschoolgg/toolkit';

import type { Activity } from '@/prisma/main.js';
import { activity_type_enum } from '@/prisma/main.js';
import { autocompleteMonsters } from '@/lib/minions/data/killableMonsters/index.js';
import { Fishing } from '@/lib/skilling/skills/fishing/fishing.js';
import Mining from '@/lib/skilling/skills/mining.js';
import Woodcutting from '@/lib/skilling/skills/woodcutting/woodcutting.js';
import {
	clearQueue,
	DAILY_QUEUE_CAP,
	describeActivity,
	getMaxQueueDepth,
	getQueueStatus,
	processNextQueuedTrip,
	queueTrip,
	removeQueuedTrip
} from '@/lib/tripQueue.js';
import { fetchRepeatTrips, taskCanBeRepeated } from '@/lib/util/repeatStoredTrip.js';

const staticActivities: { name: string; value: string; aliases: string[] }[] = [
	{ name: 'Raid: Chambers of Xeric', value: 'raid_cox', aliases: ['cox', 'chambers', 'xeric', 'raid1'] },
	{ name: 'Raid: Theatre of Blood', value: 'raid_tob', aliases: ['tob', 'theatre', 'raid2'] },
	{ name: 'Raid: Tombs of Amascut', value: 'raid_toa', aliases: ['toa', 'tombs', 'amascut', 'raid3'] },
	{ name: 'Minigame: Fortis Colosseum', value: 'mg_colo', aliases: ['colo', 'colosseum', 'fortis'] },
	{ name: 'Minigame: The Inferno', value: 'mg_inferno', aliases: ['inferno', 'zuk'] },
	{ name: 'Minigame: Fight Caves', value: 'mg_fight_caves', aliases: ['fight caves', 'jad', 'caves'] },
	{ name: 'Minigame: The Gauntlet', value: 'mg_gauntlet', aliases: ['gauntlet', 'hunllef'] },
	{ name: 'Minigame: Corrupted Gauntlet', value: 'mg_corrupted_gauntlet', aliases: ['corrupted gauntlet', 'cg'] },
	{ name: 'Minigame: Wintertodt', value: 'mg_wintertodt', aliases: ['wintertodt', 'wt'] },
	{ name: 'Minigame: Tempoross', value: 'mg_tempoross', aliases: ['tempoross', 'tempo'] },
	{ name: 'Minigame: Zalcano', value: 'mg_zalcano', aliases: ['zalcano', 'zalc'] },
	{ name: 'Activity: Questing', value: 'activity_questing', aliases: ['quest', 'questing'] },
	{ name: 'Clue: Beginner', value: 'clue_beginner', aliases: ['beginner', 'beginner clue'] },
	{ name: 'Clue: Easy', value: 'clue_easy', aliases: ['easy', 'easy clue'] },
	{ name: 'Clue: Medium', value: 'clue_medium', aliases: ['medium', 'medium clue', 'med clue'] },
	{ name: 'Clue: Hard', value: 'clue_hard', aliases: ['hard', 'hard clue'] },
	{ name: 'Clue: Elite', value: 'clue_elite', aliases: ['elite', 'elite clue'] },
	{ name: 'Clue: Master', value: 'clue_master', aliases: ['master', 'master clue'] },
	{ name: 'Clue: Grandmaster', value: 'clue_grandmaster', aliases: ['grandmaster', 'gmc', 'gm clue'] }
];

export const queueCommand = defineCommand({
	name: 'queue',
	description: 'Queue minion trips to run back-to-back (Patron perk).',
	attributes: {
		requiresMinion: true,
		examples: ['/queue add', '/queue repeat', '/queue list', '/queue clear']
	},
	options: [
		{
			type: 'Subcommand',
			name: 'add',
			description: 'Add a specific trip to your queue.',
			options: [
				{
					type: 'String',
					name: 'trip',
					description: 'The trip you want to queue (search monsters, bosses, skilling, raids, clues).',
					required: true,
					autocomplete: async ({ value, user }: StringAutoComplete) => {
						const query = (value ?? '').trim().toLowerCase();
						const results: { name: string; value: string }[] = [];

						if (!query) {
							const recentTrips = await fetchRepeatTrips(user);
							if (recentTrips.length > 0) {
								results.push({
									name: `[Last Trip] ${describeActivity(recentTrips[0])}`,
									value: 'last'
								});
							}
							const pinned = await prisma.pinnedTrip.findMany({
								where: { user_id: user.id }
							});
							for (const p of pinned) {
								const label = p.custom_name
									? `[Pinned] ${p.custom_name} (${describeActivity({ type: p.activity_type, data: p.data })})`
									: `[Pinned] ${describeActivity({ type: p.activity_type, data: p.data })}`;
								results.push({ name: label, value: `pinned_${p.id}` });
							}
							for (const t of recentTrips) {
								results.push({
									name: `Recent: ${describeActivity(t)} (${formatDuration(Date.now() - new Date(t.finish_date).getTime())} ago)`,
									value: `activity_${t.id}`
								});
							}
							for (const sa of staticActivities) {
								if (results.length >= 25) break;
								results.push({ name: sa.name, value: sa.value });
							}
							return results.slice(0, 25);
						}

						const recentTrips = await fetchRepeatTrips(user);
						if (recentTrips.length > 0) {
							const lastDesc = describeActivity(recentTrips[0]);
							if (lastDesc.toLowerCase().includes(query)) {
								results.push({ name: `[Last Trip] ${lastDesc}`, value: 'last' });
							}
						}

						const pinned = await prisma.pinnedTrip.findMany({ where: { user_id: user.id } });
						for (const p of pinned) {
							const desc = describeActivity({ type: p.activity_type, data: p.data });
							const custom = p.custom_name ?? '';
							if (desc.toLowerCase().includes(query) || custom.toLowerCase().includes(query)) {
								const label = custom ? `[Pinned] ${custom} (${desc})` : `[Pinned] ${desc}`;
								results.push({ name: label, value: `pinned_${p.id}` });
							}
						}

						for (const sa of staticActivities) {
							if (
								sa.name.toLowerCase().includes(query) ||
								sa.aliases.some(a => a.toLowerCase().includes(query))
							) {
								results.push({ name: sa.name, value: sa.value });
							}
						}

						for (const mon of autocompleteMonsters) {
							if (results.length >= 25) break;
							const nameMatch = mon.name.toLowerCase().includes(query);
							const aliasMatch = mon.aliases?.some(a => a.toLowerCase().includes(query));
							if (nameMatch || aliasMatch) {
								const label =
									'canBePked' in mon && mon.canBePked
										? `Monster: ${mon.name} (Wilderness)`
										: `Monster: ${mon.name}`;
								results.push({ name: label, value: `monster_${mon.id}` });
							}
						}

						for (const log of Woodcutting.Logs) {
							if (results.length >= 25) break;
							if (log.name.toLowerCase().includes(query)) {
								results.push({ name: `Woodcutting: ${log.name}`, value: `wc_${log.name}` });
							}
						}

						for (const ore of Mining.Ores) {
							if (results.length >= 25) break;
							if (ore.name.toLowerCase().includes(query)) {
								results.push({ name: `Mining: ${ore.name}`, value: `mine_${ore.name}` });
							}
						}

						for (const fish of Fishing.Fishes) {
							if (results.length >= 25) break;
							if (fish.name.toLowerCase().includes(query)) {
								results.push({ name: `Fishing: ${fish.name}`, value: `fish_${fish.name}` });
							}
						}

						return results.slice(0, 25);
					}
				},
				{
					type: 'Integer',
					name: 'quantity',
					description: 'Number of times to queue this trip (default: 1).',
					required: false,
					min_value: 1,
					max_value: 4
				},
				{
					type: 'Boolean',
					name: 'wilderness',
					description: 'Whether to fight the monster in the wilderness (if applicable).',
					required: false
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'repeat',
			description: 'Add your last completed or current trip to the queue.',
			options: [
				{
					type: 'Integer',
					name: 'quantity',
					description: 'Number of times to queue this trip (default: 1).',
					required: false,
					min_value: 1,
					max_value: 4
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'list',
			description: 'View your queued trips, queue capacity, and daily limit.',
			options: []
		},
		{
			type: 'Subcommand',
			name: 'clear',
			description: 'Remove all trips from your queue.',
			options: []
		},
		{
			type: 'Subcommand',
			name: 'remove',
			description: 'Remove a specific trip from your queue by its position number.',
			options: [
				{
					type: 'Integer',
					name: 'position',
					description: 'The position number of the trip to remove (1-indexed).',
					required: true,
					min_value: 1
				}
			]
		}
	],
	run: async ({ user, channelId, options }) => {
		const perkTier = await user.fetchPerkTier();
		const maxDepth = getMaxQueueDepth(perkTier);

		if (maxDepth === 0) {
			return 'Trip queuing is a patron perk (Tier 4: 1 trip, Tier 5: 2 trips, Tier 6+: 4 trips).';
		}

		if (options.add) {
			const tripSelection = options.add.trip;
			const quantity = Math.max(1, Math.min(options.add.quantity ?? 1, 4));

			const { trips: currentTrips, depthLimit, dailyRemaining } = await getQueueStatus(user);

			if (dailyRemaining <= 0) {
				return `You have already used all ${DAILY_QUEUE_CAP} of your queued trips today. Your daily limit resets at midnight EST.`;
			}

			const remainingSlots = depthLimit - currentTrips.length;
			if (remainingSlots <= 0) {
				return `Your trip queue is full (${currentTrips.length}/${depthLimit} queued). Tier ${perkTier} patron limit reached.`;
			}

			const resolveActivity = async (sel: string): Promise<Activity | null> => {
				if (sel === 'last') {
					const recent = await fetchRepeatTrips(user);
					return recent.length > 0 ? recent[0] : null;
				}
				if (sel.startsWith('pinned_')) {
					const pinnedId = sel.replace('pinned_', '');
					const pinned = await prisma.pinnedTrip.findFirst({ where: { user_id: user.id, id: pinnedId } });
					if (!pinned) return null;
					return {
						id: 0,
						user_id: BigInt(user.id),
						start_date: new Date(),
						finish_date: new Date(),
						duration: 0,
						completed: true,
						group_activity: false,
						type: pinned.activity_type,
						channel_id: BigInt(channelId),
						data: pinned.data,
						all_user_ids: [BigInt(user.id)]
					};
				}
				if (sel.startsWith('activity_')) {
					const actId = parseInt(sel.replace('activity_', ''), 10);
					if (!Number.isNaN(actId)) {
						const act = await prisma.activity.findFirst({ where: { id: actId, user_id: BigInt(user.id) } });
						if (act && taskCanBeRepeated(act)) return act;
					}
				}
				if (sel.startsWith('monster_')) {
					const monId = parseInt(sel.replace('monster_', ''), 10);
					const mon = autocompleteMonsters.find(m => m.id === monId);
					if (mon) {
						if (mon.name.toLowerCase() === 'nex') {
							return {
								id: 0,
								user_id: BigInt(user.id),
								start_date: new Date(),
								finish_date: new Date(),
								duration: 0,
								completed: true,
								group_activity: false,
								type: activity_type_enum.Nex,
								channel_id: BigInt(channelId),
								data: { users: [user.id] },
								all_user_ids: [BigInt(user.id)]
							};
						}
						const isWildy = Boolean(
							options.add?.wilderness ?? ('canBePked' in mon && mon.canBePked ? true : false)
						);
						return {
							id: 0,
							user_id: BigInt(user.id),
							start_date: new Date(),
							finish_date: new Date(),
							duration: 0,
							completed: true,
							group_activity: false,
							type: activity_type_enum.MonsterKilling,
							channel_id: BigInt(channelId),
							data: {
								mi: mon.id,
								iQty: undefined,
								usingCannon: false,
								cannonMulti: false,
								chinning: false,
								bob: 0,
								isInWilderness: isWildy,
								onTask: false
							},
							all_user_ids: [BigInt(user.id)]
						};
					}
				}
				if (sel.startsWith('wc_')) {
					const logName = sel.replace('wc_', '');
					const log = Woodcutting.Logs.find(l => l.name.toLowerCase() === logName.toLowerCase());
					return {
						id: 0,
						user_id: BigInt(user.id),
						start_date: new Date(),
						finish_date: new Date(),
						duration: 0,
						completed: true,
						group_activity: false,
						type: activity_type_enum.Woodcutting,
						channel_id: BigInt(channelId),
						data: { logID: log ? log.id : logName, iQty: undefined, powerchop: false },
						all_user_ids: [BigInt(user.id)]
					};
				}
				if (sel.startsWith('mine_')) {
					const oreName = sel.replace('mine_', '');
					return {
						id: 0,
						user_id: BigInt(user.id),
						start_date: new Date(),
						finish_date: new Date(),
						duration: 0,
						completed: true,
						group_activity: false,
						type: activity_type_enum.Mining,
						channel_id: BigInt(channelId),
						data: { oreID: oreName, iQty: undefined, powermine: false },
						all_user_ids: [BigInt(user.id)]
					};
				}
				if (sel.startsWith('fish_')) {
					const fishName = sel.replace('fish_', '');
					return {
						id: 0,
						user_id: BigInt(user.id),
						start_date: new Date(),
						finish_date: new Date(),
						duration: 0,
						completed: true,
						group_activity: false,
						type: activity_type_enum.Fishing,
						channel_id: BigInt(channelId),
						data: { identifier: fishName },
						all_user_ids: [BigInt(user.id)]
					};
				}
				if (sel === 'raid_cox') {
					return {
						id: 0,
						user_id: BigInt(user.id),
						start_date: new Date(),
						finish_date: new Date(),
						duration: 0,
						completed: true,
						group_activity: false,
						type: activity_type_enum.Raids,
						channel_id: BigInt(channelId),
						data: { users: [user.id], challengeMode: false },
						all_user_ids: [BigInt(user.id)]
					};
				}
				if (sel === 'raid_tob') {
					return {
						id: 0,
						user_id: BigInt(user.id),
						start_date: new Date(),
						finish_date: new Date(),
						duration: 0,
						completed: true,
						group_activity: false,
						type: activity_type_enum.TheatreOfBlood,
						channel_id: BigInt(channelId),
						data: { users: [user.id], solo: true, hardMode: false },
						all_user_ids: [BigInt(user.id)]
					};
				}
				if (sel === 'raid_toa') {
					return {
						id: 0,
						user_id: BigInt(user.id),
						start_date: new Date(),
						finish_date: new Date(),
						duration: 0,
						completed: true,
						group_activity: false,
						type: activity_type_enum.TombsOfAmascut,
						channel_id: BigInt(channelId),
						data: { users: [user.id], solo: true, raidLevel: 1 },
						all_user_ids: [BigInt(user.id)]
					};
				}
				if (sel === 'mg_colo') {
					return {
						id: 0,
						user_id: BigInt(user.id),
						start_date: new Date(),
						finish_date: new Date(),
						duration: 0,
						completed: true,
						group_activity: false,
						type: activity_type_enum.Colosseum,
						channel_id: BigInt(channelId),
						data: {},
						all_user_ids: [BigInt(user.id)]
					};
				}
				if (sel === 'mg_inferno') {
					return {
						id: 0,
						user_id: BigInt(user.id),
						start_date: new Date(),
						finish_date: new Date(),
						duration: 0,
						completed: true,
						group_activity: false,
						type: activity_type_enum.Inferno,
						channel_id: BigInt(channelId),
						data: { isEmergedZuk: false },
						all_user_ids: [BigInt(user.id)]
					};
				}
				if (sel === 'mg_fight_caves') {
					return {
						id: 0,
						user_id: BigInt(user.id),
						start_date: new Date(),
						finish_date: new Date(),
						duration: 0,
						completed: true,
						group_activity: false,
						type: activity_type_enum.FightCaves,
						channel_id: BigInt(channelId),
						data: {},
						all_user_ids: [BigInt(user.id)]
					};
				}
				if (sel === 'mg_gauntlet') {
					return {
						id: 0,
						user_id: BigInt(user.id),
						start_date: new Date(),
						finish_date: new Date(),
						duration: 0,
						completed: true,
						group_activity: false,
						type: activity_type_enum.Gauntlet,
						channel_id: BigInt(channelId),
						data: { corrupted: false },
						all_user_ids: [BigInt(user.id)]
					};
				}
				if (sel === 'mg_corrupted_gauntlet') {
					return {
						id: 0,
						user_id: BigInt(user.id),
						start_date: new Date(),
						finish_date: new Date(),
						duration: 0,
						completed: true,
						group_activity: false,
						type: activity_type_enum.Gauntlet,
						channel_id: BigInt(channelId),
						data: { corrupted: true },
						all_user_ids: [BigInt(user.id)]
					};
				}
				if (sel === 'mg_wintertodt') {
					return {
						id: 0,
						user_id: BigInt(user.id),
						start_date: new Date(),
						finish_date: new Date(),
						duration: 0,
						completed: true,
						group_activity: false,
						type: activity_type_enum.Wintertodt,
						channel_id: BigInt(channelId),
						data: {},
						all_user_ids: [BigInt(user.id)]
					};
				}
				if (sel === 'mg_tempoross') {
					return {
						id: 0,
						user_id: BigInt(user.id),
						start_date: new Date(),
						finish_date: new Date(),
						duration: 0,
						completed: true,
						group_activity: false,
						type: activity_type_enum.Tempoross,
						channel_id: BigInt(channelId),
						data: {},
						all_user_ids: [BigInt(user.id)]
					};
				}
				if (sel === 'mg_zalcano') {
					return {
						id: 0,
						user_id: BigInt(user.id),
						start_date: new Date(),
						finish_date: new Date(),
						duration: 0,
						completed: true,
						group_activity: false,
						type: activity_type_enum.Zalcano,
						channel_id: BigInt(channelId),
						data: {},
						all_user_ids: [BigInt(user.id)]
					};
				}
				if (sel === 'activity_questing' || sel === 'quest' || sel === 'questing') {
					return {
						id: 0,
						user_id: BigInt(user.id),
						start_date: new Date(),
						finish_date: new Date(),
						duration: 0,
						completed: true,
						group_activity: false,
						type: activity_type_enum.Questing,
						channel_id: BigInt(channelId),
						data: {},
						all_user_ids: [BigInt(user.id)]
					};
				}
				if (sel.startsWith('clue_')) {
					const tierName = sel.replace('clue_', '');
					return {
						id: 0,
						user_id: BigInt(user.id),
						start_date: new Date(),
						finish_date: new Date(),
						duration: 0,
						completed: true,
						group_activity: false,
						type: activity_type_enum.ClueCompletion,
						channel_id: BigInt(channelId),
						data: { ci: tierName, q: undefined },
						all_user_ids: [BigInt(user.id)]
					};
				}

				const staticMatch = staticActivities.find(
					s =>
						s.name.toLowerCase() === sel.toLowerCase() ||
						s.aliases.some(a => a.toLowerCase() === sel.toLowerCase())
				);
				if (staticMatch) {
					return resolveActivity(staticMatch.value);
				}

				const monMatch = autocompleteMonsters.find(
					m =>
						m.name.toLowerCase() === sel.toLowerCase() ||
						m.aliases?.some(a => a.toLowerCase() === sel.toLowerCase())
				);
				if (monMatch) {
					return resolveActivity(`monster_${monMatch.id}`);
				}

				const wcMatch = Woodcutting.Logs.find(l => l.name.toLowerCase() === sel.toLowerCase());
				if (wcMatch) {
					return resolveActivity(`wc_${wcMatch.name}`);
				}

				const mineMatch = Mining.Ores.find(o => o.name.toLowerCase() === sel.toLowerCase());
				if (mineMatch) {
					return resolveActivity(`mine_${mineMatch.name}`);
				}

				const fishMatch = Fishing.Fishes.find(f => f.name.toLowerCase() === sel.toLowerCase());
				if (fishMatch) {
					return resolveActivity(`fish_${fishMatch.name}`);
				}

				const recentList = await fetchRepeatTrips(user);
				const recentMatch = recentList.find(
					r =>
						r.type.toLowerCase() === sel.toLowerCase() ||
						r.id.toString() === sel ||
						describeActivity(r).toLowerCase().includes(sel.toLowerCase())
				);
				return recentMatch ?? null;
			};

			const activityToQueue = await resolveActivity(tripSelection);
			if (!activityToQueue) {
				return `Could not find a valid repeatable trip matching "${tripSelection}". Please pick an option from the autocomplete list.`;
			}

			const toAdd = Math.min(quantity, remainingSlots);
			for (let i = 0; i < toAdd; i++) {
				await queueTrip({
					user,
					activity: activityToQueue,
					channelId
				});
			}

			const tripName = describeActivity(activityToQueue);
			const minionBusy = await user.minionIsBusy();

			if (!minionBusy) {
				await processNextQueuedTrip(user.id, channelId);
				const remainingInQueue = currentTrips.length + toAdd - 1;
				return `Started queued trip (${tripName}) immediately!${
					remainingInQueue > 0 ? ` (${remainingInQueue} trip(s) remaining in queue)` : ''
				}`;
			}

			return `Queued ${toAdd}x ${tripName} trip(s)! (${currentTrips.length + toAdd}/${depthLimit} in queue).`;
		}

		if (options.repeat) {
			const quantity = Math.max(1, Math.min(options.repeat.quantity ?? 1, 4));
			const trips = await fetchRepeatTrips(user);
			if (trips.length === 0) {
				return "Couldn't find any recent trip to queue.";
			}

			const { trips: currentTrips, depthLimit, dailyRemaining } = await getQueueStatus(user);

			if (dailyRemaining <= 0) {
				return `You have already used all ${DAILY_QUEUE_CAP} of your queued trips today. Your daily limit resets at midnight EST.`;
			}

			const remainingSlots = depthLimit - currentTrips.length;
			if (remainingSlots <= 0) {
				return `Your trip queue is full (${currentTrips.length}/${depthLimit} queued). Tier ${perkTier} patron limit reached.`;
			}

			const activityToQueue = trips[0];
			const toAdd = Math.min(quantity, remainingSlots);

			for (let i = 0; i < toAdd; i++) {
				await queueTrip({
					user,
					activity: activityToQueue,
					channelId
				});
			}

			const tripName = describeActivity(activityToQueue);
			const minionBusy = await user.minionIsBusy();

			if (!minionBusy) {
				await processNextQueuedTrip(user.id, channelId);
				const remainingInQueue = currentTrips.length + toAdd - 1;
				return `Started queued trip (${tripName}) immediately!${
					remainingInQueue > 0 ? ` (${remainingInQueue} trip(s) remaining in queue)` : ''
				}`;
			}

			return `Queued ${toAdd}x ${tripName} trip(s)! (${currentTrips.length + toAdd}/${depthLimit} in queue).`;
		}

		if (options.list) {
			const { trips, depthLimit, dailyUsed, dailyRemaining } = await getQueueStatus(user);
			let response = `**${user.minionName}'s Trip Queue**\n`;
			response += `• Queue Capacity: ${trips.length}/${depthLimit} (Tier ${perkTier} Patron)\n`;
			response += `• Daily Trips: ${dailyUsed}/${DAILY_QUEUE_CAP} used today (${dailyRemaining} remaining, resets at midnight EST)\n\n`;

			if (trips.length === 0) {
				response +=
					'Your trip queue is currently empty. Use /queue add, /queue repeat, or the Queue Repeat button on trip finish to queue trips.';
			} else {
				response += '**Queued Trips (in order of execution):**\n';
				for (let i = 0; i < trips.length; i++) {
					const t = trips[i];
					const addedDate = new Date(t.created_at).toLocaleTimeString();
					const desc = describeActivity({ type: t.activity_type, data: t.data });
					response += `${i + 1}. **${desc}** (queued at ${addedDate})\n`;
				}
			}

			return response;
		}

		if (options.clear) {
			const clearedCount = await clearQueue(user);
			if (clearedCount === 0) {
				return 'Your queue is already empty.';
			}
			return `Cleared **${clearedCount}** trip${clearedCount === 1 ? '' : 's'} from your queue.`;
		}

		if (options.remove) {
			const pos = options.remove.position;
			const removed = await removeQueuedTrip(user, pos - 1);
			if (!removed) {
				return `No trip found at position ${pos}. Use \`/queue list\` to check your queued trips.`;
			}
			const desc = describeActivity({ type: removed.activity_type, data: removed.data });
			return `Removed **${desc}** (position ${pos}) from your trip queue.`;
		}

		return 'Invalid queue command.';
	}
});

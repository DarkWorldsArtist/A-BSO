import {
	discontinuedHalloweenCommonsTable,
	discontinuedHalloweenRaresTable,
	discontinuedHalloweenUniquesTable,
	PumpkinIshBoxTable
} from '@/lib/bso/openables/holidayOpenables.js';

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { EmbedBuilder, userMention } from '@oldschoolgg/discord';
import { formatDuration, noOp, Time } from '@oldschoolgg/toolkit';
import { percentChance, randArrItem, roll } from 'node-rng';
import { Bank, Items, LootTable } from 'oldschooljs';
import { clamp } from 'remeda';

import { Channel, globalConfig } from '@/lib/constants.js';
import type { ActivityTaskData } from '@/lib/types/minions.js';

export const halloweenTripRewardTable = new LootTable()
	.add('Spooky box')
	.add('Halloween cracker')
	.add('Pumpkin-ish box');

export {
	discontinuedHalloweenCommonsTable,
	discontinuedHalloweenRaresTable,
	discontinuedHalloweenUniquesTable,
	PumpkinIshBoxTable
};

export interface HalloweenEventState {
	currentHolderId: string | null;
	heldSince: number | null;
	lastTripAt: number | null;
	immunityUntil: number | null;
	greasedUntil: number | null;
	hasScaredCrow: boolean;
	escaped: boolean;
	previousHolderId: string | null;
	lastStealAttempt: Record<string, number>;
	hasAlluring: Record<string, boolean>;
	totalHoldTimes: Record<string, number>;
	tripCooldowns: Record<string, number>;
	ticketsAwarded: Record<string, number>;
	boxesAwarded: Record<string, number>;
}

const STATE_FILE_PATH = path.resolve('data/bso/cursed-pumpkin.json');

const defaultState: HalloweenEventState = {
	currentHolderId: null,
	heldSince: null,
	lastTripAt: null,
	immunityUntil: null,
	greasedUntil: null,
	hasScaredCrow: false,
	escaped: true,
	previousHolderId: null,
	lastStealAttempt: {},
	hasAlluring: {},
	totalHoldTimes: {},
	tripCooldowns: {},
	ticketsAwarded: {},
	boxesAwarded: {}
};

export function getHalloweenState(): HalloweenEventState {
	if (!existsSync(STATE_FILE_PATH)) {
		return { ...defaultState };
	}
	try {
		const raw = readFileSync(STATE_FILE_PATH, 'utf-8');
		const parsed = JSON.parse(raw);
		return {
			...defaultState,
			...parsed,
			lastStealAttempt: parsed.lastStealAttempt ?? {},
			hasAlluring: parsed.hasAlluring ?? {},
			totalHoldTimes: parsed.totalHoldTimes ?? {},
			tripCooldowns: parsed.tripCooldowns ?? {},
			ticketsAwarded: parsed.ticketsAwarded ?? {},
			boxesAwarded: parsed.boxesAwarded ?? {}
		};
	} catch {
		return { ...defaultState };
	}
}

export function saveHalloweenState(state: HalloweenEventState) {
	writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

const GIMMICK_ITEMS = ['Rotten pumpkin', 'Greased pumpkin', 'Alluring pumpkin', 'Scared-crow'] as const;

export function getRandomGimmickItem() {
	const name = randArrItem(GIMMICK_ITEMS);
	return Items.getOrThrow(name);
}

function aOrAn(name: string): string {
	const firstLetter = name.trim().charAt(0).toLowerCase();
	if (['a', 'e', 'i', 'o', 'u'].includes(firstLetter)) {
		return `an ${name}`;
	}
	return `a ${name}`;
}

export function calculateAndAwardHoldRewards(state: HalloweenEventState, holderId: string, now: number) {
	if (state.heldSince !== null) {
		const sessionDuration = now - state.heldSince;
		state.totalHoldTimes[holderId] = (state.totalHoldTimes[holderId] ?? 0) + sessionDuration;
	}

	const totalMs = state.totalHoldTimes[holderId] ?? 0;
	const totalMinutes = Math.floor(totalMs / Time.Minute);

	const totalTicketsDue = Math.floor(totalMinutes / 5);
	const totalBoxesDue = Math.floor(totalMinutes / 10);

	const alreadyGivenTickets = state.ticketsAwarded[holderId] ?? 0;
	const alreadyGivenBoxes = state.boxesAwarded[holderId] ?? 0;

	const newTickets = Math.max(0, totalTicketsDue - alreadyGivenTickets);
	const newBoxes = Math.max(0, totalBoxesDue - alreadyGivenBoxes);

	state.ticketsAwarded[holderId] = alreadyGivenTickets + newTickets;
	state.boxesAwarded[holderId] = alreadyGivenBoxes + newBoxes;

	return { newTickets, newBoxes };
}

export async function handleHalloweenTripFinish({
	user,
	data
}: {
	user: MUser;
	data: ActivityTaskData;
	messages: string[];
}): Promise<{ itemsToAddWithCL?: Bank; contentAppendix?: string } | void> {
	const state = getHalloweenState();
	const now = Date.now();
	const extraItems = new Bank();
	const halloweenMessages: string[] = [];

	if (state.currentHolderId && !state.escaped && state.lastTripAt && now - state.lastTripAt >= Time.Hour * 2) {
		const oldHolderId = state.currentHolderId;
		const oldHolder = await mUserFetch(oldHolderId);
		const { newTickets, newBoxes } = calculateAndAwardHoldRewards(state, oldHolderId, now);

		const deliveryBank = new Bank();
		if (newTickets > 0) deliveryBank.add('Rotten Raffle ticket', newTickets);
		if (newBoxes > 0) deliveryBank.add('Pumpkin-ish box', newBoxes);

		await oldHolder.removeItemsFromBank(new Bank().add('Cursed pumpkin', 1));
		if (deliveryBank.length > 0) {
			await oldHolder.addItemsToBank({ items: deliveryBank, collectionLog: true });
		}

		state.escaped = true;
		state.currentHolderId = null;
		state.heldSince = null;
		state.lastTripAt = null;
		state.immunityUntil = null;
		state.greasedUntil = null;
		state.hasScaredCrow = false;
		saveHalloweenState(state);

		await globalClient
			.sendMessage(Channel.GeneralChannel, {
				content: `The Cursed Pumpkin has grown restless and rotted in ${oldHolder.usernameOrMention}'s bank! It escaped and must be found again...`
			})
			.catch(noOp);
	}

	if (state.currentHolderId === user.id) {
		state.lastTripAt = now;
		saveHalloweenState(state);
	}

	if (state.escaped) {
		if (roll(20)) {
			const latestState = getHalloweenState();
			if (latestState.escaped) {
				latestState.escaped = false;
				latestState.currentHolderId = user.id;
				latestState.heldSince = now;
				latestState.lastTripAt = now;
				latestState.immunityUntil = now + Time.Minute * 30;
				latestState.hasScaredCrow = false;
				latestState.greasedUntil = null;
				saveHalloweenState(latestState);

				extraItems.add('Cursed pumpkin', 1);
				halloweenMessages.push(
					'Your minion stumbled across a particularly evil looking pumpkin during their trip. You now hold the Cursed Pumpkin!'
				);

				await globalClient
					.sendMessage(Channel.GeneralChannel, {
						content: `${user.usernameOrMention} has found the escaped Cursed Pumpkin!`
					})
					.catch(noOp);
			}
		}
	}

	const lastDrop = state.tripCooldowns[user.id] ?? 0;
	if (now - lastDrop >= Time.Minute * 20) {
		if (roll(20)) {
			state.tripCooldowns[user.id] = now;
			saveHalloweenState(state);
			const ambientLoot = halloweenTripRewardTable.roll();
			const ambientItemName = ambientLoot.items()[0][0].name;
			extraItems.add(ambientLoot);
			halloweenMessages.push(`You found a ${ambientItemName} during your trip!`);
		}
	}

	if (data.duration >= Time.Minute * 5) {
		if (roll(20)) {
			const gimmick = getRandomGimmickItem();
			extraItems.add(gimmick.id, 1);
			halloweenMessages.push(`You found a ${gimmick.name} during your trip!`);
		}
	}

	if (percentChance(10)) {
		extraItems.add('Rotten Raffle ticket', 1);
		halloweenMessages.push('Your minion found a Rotten raffle ticket during the trip!');
	}

	if (extraItems.length > 0 || halloweenMessages.length > 0) {
		return {
			itemsToAddWithCL: extraItems.length > 0 ? extraItems : undefined,
			contentAppendix:
				halloweenMessages.length > 0 ? `\n\n${halloweenMessages.map(m => `${m}`).join('\n')}` : undefined
		};
	}
}

export const halloweenCommand = defineCommand({
	name: 'halloween',
	description: 'Halloween event commands.',
	options: [
		{
			type: 'Subcommand',
			name: 'steal',
			description: 'Attempt to steal the Cursed Pumpkin from the current holder.'
		},
		{
			type: 'Subcommand',
			name: 'use',
			description: 'Use a Halloween interaction item.',
			options: [
				{
					type: 'String',
					name: 'item',
					description: 'The item you want to use.',
					required: true,
					choices: [
						{ name: 'Scared-crow', value: 'scared-crow' },
						{ name: 'Rotten pumpkin', value: 'rotten pumpkin' },
						{ name: 'Greased pumpkin', value: 'greased pumpkin' },
						{ name: 'Alluring pumpkin', value: 'alluring pumpkin' }
					]
				},
				{
					type: 'User',
					name: 'target',
					description: 'The target user (required when throwing a Rotten pumpkin).',
					required: false
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'pumpkin',
			description: 'View the Cursed Pumpkin status and leaderboard.'
		},
		{
			type: 'Subcommand',
			name: 'admin',
			description: 'Admin testing utilities for the Halloween event.',
			options: [
				{
					type: 'String',
					name: 'action',
					description: 'Admin action to perform.',
					required: true,
					choices: [
						{ name: 'spawn', value: 'spawn' },
						{ name: 'escape', value: 'escape' },
						{ name: 'set_holder', value: 'set_holder' },
						{ name: 'reset_cooldown', value: 'reset_cooldown' },
						{ name: 'status', value: 'status' }
					]
				},
				{
					type: 'User',
					name: 'user',
					description: 'Target user for set_holder or reset_cooldown.',
					required: false
				}
			]
		}
	],
	run: async ({ options, user }) => {
		const now = Date.now();
		const state = getHalloweenState();

		if (options.admin) {
			if (!globalConfig.adminUserIDs.includes(user.id)) {
				return 'You do not have permission to use this command.';
			}

			const action = options.admin.action;
			const targetUser = options.admin.user ? await mUserFetch(options.admin.user.user.id) : user;

			if (action === 'spawn') {
				if (state.currentHolderId && state.currentHolderId !== targetUser.id) {
					const oldHolder = await mUserFetch(state.currentHolderId);
					await oldHolder.removeItemsFromBank(new Bank().add('Cursed pumpkin', 1));
				}
				await targetUser.addItemsToBank({ items: new Bank().add('Cursed pumpkin', 1), collectionLog: true });
				state.currentHolderId = targetUser.id;
				state.heldSince = now;
				state.lastTripAt = now;
				state.immunityUntil = now + Time.Minute * 30;
				state.escaped = false;
				state.hasScaredCrow = false;
				state.greasedUntil = null;
				saveHalloweenState(state);

				await globalClient
					.sendMessage(Channel.GeneralChannel, {
						content: `The Cursed Pumpkin has arrived! ${targetUser.usernameOrMention} now holds it!`
					})
					.catch(noOp);

				return `Spawned Cursed Pumpkin and gave it to ${targetUser.usernameOrMention}.`;
			}

			if (action === 'escape') {
				if (state.currentHolderId) {
					const oldHolder = await mUserFetch(state.currentHolderId);
					const { newTickets, newBoxes } = calculateAndAwardHoldRewards(state, state.currentHolderId, now);
					const rewardBank = new Bank();
					if (newTickets > 0) rewardBank.add('Rotten Raffle ticket', newTickets);
					if (newBoxes > 0) rewardBank.add('Pumpkin-ish box', newBoxes);
					await oldHolder.removeItemsFromBank(new Bank().add('Cursed pumpkin', 1));
					if (rewardBank.length > 0) {
						await oldHolder.addItemsToBank({ items: rewardBank, collectionLog: true });
					}
					await globalClient
						.sendMessage(Channel.GeneralChannel, {
							content: `The Cursed Pumpkin has grown restless and rotted in ${oldHolder.usernameOrMention}'s bank! It escaped and must be found again...`
						})
						.catch(noOp);
				}
				state.escaped = true;
				state.currentHolderId = null;
				state.heldSince = null;
				state.lastTripAt = null;
				state.immunityUntil = null;
				state.greasedUntil = null;
				state.hasScaredCrow = false;
				saveHalloweenState(state);
				return 'The Cursed Pumpkin has escaped into the wild.';
			}

			if (action === 'reset_cooldown') {
				delete state.lastStealAttempt[targetUser.id];
				if (state.currentHolderId === targetUser.id) {
					state.immunityUntil = null;
				}
				saveHalloweenState(state);
				return `Reset steal cooldown${state.currentHolderId === targetUser.id ? ' and holder immunity' : ''} for ${targetUser.usernameOrMention}.`;
			}

			if (action === 'set_holder') {
				if (state.currentHolderId && state.currentHolderId !== targetUser.id) {
					const oldHolder = await mUserFetch(state.currentHolderId);
					await oldHolder.removeItemsFromBank(new Bank().add('Cursed pumpkin', 1));
				}
				await targetUser.addItemsToBank({ items: new Bank().add('Cursed pumpkin', 1), collectionLog: true });
				state.currentHolderId = targetUser.id;
				state.heldSince = now;
				state.lastTripAt = now;
				state.immunityUntil = now + Time.Minute * 30;
				state.escaped = false;
				state.hasScaredCrow = false;
				state.greasedUntil = null;
				saveHalloweenState(state);
				return `Set holder to ${targetUser.usernameOrMention}.`;
			}

			if (action === 'status') {
				return `\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\``;
			}
		}

		if (options.use) {
			const itemChoice = options.use.item.toLowerCase();
			const targetUser = options.use.target ? await mUserFetch(options.use.target.user.id) : null;

			if (itemChoice === 'scared-crow') {
				if (user.bank.amount('Scared-crow') < 1) {
					return "You don't have a Scared-crow in your bank.";
				}
				if (user.id !== state.currentHolderId || state.escaped) {
					return 'You can only use a scared-crow while holding the Cursed pumpkin!';
				}
				if (state.hasScaredCrow) {
					return 'You already have a scared-crow guarding your Cursed pumpkin!';
				}
				await user.removeItemsFromBank(new Bank().add('Scared-crow', 1));
				state.hasScaredCrow = true;
				saveHalloweenState(state);
				return "Your minion sets out a scared-crow to guard the Cursed pumpkin. Your minion has questions about the scared-crow's qualifications for the job.";
			}

			if (itemChoice === 'rotten pumpkin') {
				if (user.bank.amount('Rotten pumpkin') < 1) {
					return "You don't have a Rotten pumpkin in your bank.";
				}
				if (!targetUser) {
					return 'You must specify who you want to hurl the Rotten pumpkin at!';
				}
				if (state.escaped || targetUser.id !== state.currentHolderId) {
					return `${targetUser.usernameOrMention} is not holding the Cursed pumpkin!`;
				}
				if (!state.immunityUntil || state.immunityUntil <= now) {
					return `${targetUser.usernameOrMention}'s Cursed pumpkin is not currently immune!`;
				}
				state.immunityUntil = Math.max(now, state.immunityUntil - Time.Minute * 10);
				await user.removeItemsFromBank(new Bank().add('Rotten pumpkin', 1));
				saveHalloweenState(state);
				return `Your minion begrudgingly picks up the Rotten pumpkin and hurls it at ${targetUser.usernameOrMention}. Their immunity window has decreased by 10 minutes!`;
			}

			if (itemChoice === 'greased pumpkin') {
				if (user.bank.amount('Greased pumpkin') < 1) {
					return "You don't have a Greased pumpkin in your bank.";
				}
				if (user.id !== state.currentHolderId || state.escaped) {
					return 'You can only grease the Cursed pumpkin while holding it!';
				}
				await user.removeItemsFromBank(new Bank().add('Greased pumpkin', 1));
				if (state.greasedUntil && state.greasedUntil > now) {
					state.greasedUntil += Time.Hour;
				} else {
					state.greasedUntil = now + Time.Hour;
				}
				saveHalloweenState(state);
				return 'Your minion does something unsightly with the Greased pumpkin and would rather not talk about it. They feel safer from any would-be thieves now.';
			}

			if (itemChoice === 'alluring pumpkin') {
				if (user.bank.amount('Alluring pumpkin') < 1) {
					return "You don't have an Alluring pumpkin in your bank.";
				}
				if (state.hasAlluring[user.id]) {
					return 'Your minion has already eaten an Alluring pumpkin pie for their next steal attempt!';
				}
				await user.removeItemsFromBank(new Bank().add('Alluring pumpkin', 1));
				state.hasAlluring[user.id] = true;
				saveHalloweenState(state);
				return 'Your minion bakes a delectable pie out of the Alluring pumpkin and eats it whole! They feel certain they have a better chance at stealing the Cursed pumpkin now.';
			}

			return 'Invalid item specified.';
		}

		if (options.steal) {
			if (user.id === state.currentHolderId && !state.escaped) {
				return 'You are already holding the Cursed pumpkin!';
			}
			if (state.escaped || !state.currentHolderId) {
				return 'The Cursed Pumpkin has escaped and is currently lost in the wild!';
			}

			const lastAttempt = state.lastStealAttempt[user.id] ?? 0;
			if (now - lastAttempt < Time.Minute * 30) {
				const remaining = Time.Minute * 30 - (now - lastAttempt);
				return `Your minion is still exhausted from their last failed steal attempt. Try again in ${formatDuration(remaining)}.`;
			}

			if (state.immunityUntil && state.immunityUntil > now) {
				const remainingImmunity = state.immunityUntil - now;
				return `The Cursed Pumpkin is currently protected by dark magic and cannot be stolen for another ${formatDuration(remainingImmunity)}.`;
			}

			const currentHolder = await mUserFetch(state.currentHolderId);

			let chance = 30;
			const heldDuration = now - (state.heldSince ?? now);
			const fifteenMinBlocks = Math.floor(heldDuration / (Time.Minute * 15));
			chance += fifteenMinBlocks * 5;

			if (state.hasAlluring[user.id]) {
				chance += 20;
				delete state.hasAlluring[user.id];
			}

			const hadScaredCrow = state.hasScaredCrow;
			const hadGreasedPumpkin = Boolean(state.greasedUntil && state.greasedUntil > now);

			if (hadGreasedPumpkin) {
				chance -= 15;
			}

			if (user.id === state.previousHolderId) {
				chance -= 30;
			}

			chance = clamp(chance, { min: 20, max: 95 });
			const succeeded = percentChance(chance);

			if (succeeded) {
				if (hadScaredCrow) {
					const protectionChance = hadGreasedPumpkin ? 90 : 70;
					if (percentChance(protectionChance)) {
						state.hasScaredCrow = false;
						state.lastStealAttempt[user.id] = now - Time.Minute * 15;
						const itemAwarded = percentChance(50);
						if (itemAwarded) {
							const rewardItem = getRandomGimmickItem();
							await user.addItemsToBank({ items: new Bank().add(rewardItem.id, 1), collectionLog: true });
							saveHalloweenState(state);
							return `Your minion encounters an awfully scared looking scarecrow on the way, so they decide to make it feel better instead of stealing from ${currentHolder.usernameOrMention}. It rewards them with ${aOrAn(rewardItem.name)}! Your steal cooldown has been reduced to 15 minutes.`;
						}
						saveHalloweenState(state);
						return `Your minion encountered an awfully scared looking scarecrow guarding the pumpkin and was frightened away! Your steal cooldown has been reduced to 15 minutes.`;
					}
				}

				const { newTickets, newBoxes } = calculateAndAwardHoldRewards(state, currentHolder.id, now);
				const rewardBank = new Bank();
				if (newTickets > 0) rewardBank.add('Rotten Raffle ticket', newTickets);
				if (newBoxes > 0) rewardBank.add('Pumpkin-ish box', newBoxes);

				let consolationItem: string | null = null;
				if (roll(10)) {
					const consolationLoot = halloweenTripRewardTable.roll();
					consolationItem = consolationLoot.items()[0][0].name;
					rewardBank.add(consolationLoot);
				}

				await currentHolder.removeItemsFromBank(new Bank().add('Cursed pumpkin', 1));
				if (rewardBank.length > 0) {
					await currentHolder.addItemsToBank({ items: rewardBank, collectionLog: true });
				}
				await user.addItemsToBank({ items: new Bank().add('Cursed pumpkin', 1), collectionLog: true });

				let extraImmunity = 0;
				if (hadScaredCrow && hadGreasedPumpkin) {
					extraImmunity = Time.Minute * 20;
				} else if (hadScaredCrow || hadGreasedPumpkin) {
					extraImmunity = Time.Minute * 10;
				}
				const immunityDuration = Time.Minute * 30 + extraImmunity;

				state.previousHolderId = currentHolder.id;
				state.currentHolderId = user.id;
				state.heldSince = now;
				state.lastTripAt = now;
				state.immunityUntil = now + immunityDuration;
				state.hasScaredCrow = false;
				state.greasedUntil = null;
				state.escaped = false;
				saveHalloweenState(state);

				let announcement = `${user.usernameOrMention} has stolen the Cursed Pumpkin from ${currentHolder.usernameOrMention}!\n${userMention(currentHolder.id)} Your minion lost the cursed pumpkin, but gained ${newTickets}x Rotten Raffle ticket and ${newBoxes}x Pumpkin-ish box!`;
				if (consolationItem) {
					announcement += `\nYour minion stole the Cursed pumpkin and it left something behind for ${currentHolder.usernameOrMention}!`;
				}

				await globalClient
					.sendMessage(Channel.GeneralChannel, {
						content: announcement,
						allowedMentions: { users: [currentHolder.id] }
					})
					.catch(noOp);

				return `You successfully stole the Cursed Pumpkin from ${currentHolder.usernameOrMention}! You have ${formatDuration(immunityDuration)} of steal immunity.`;
			}

			state.lastStealAttempt[user.id] = now;
			if (roll(10)) {
				const failedLoot = halloweenTripRewardTable.roll();
				const item = failedLoot.items()[0][0];
				await user.addItemsToBank({ items: failedLoot, collectionLog: true });
				saveHalloweenState(state);
				return `Your minion failed to steal the Cursed Pumpkin from ${currentHolder.usernameOrMention}, but they hope this ${item.name} is close enough!`;
			}
			const failedLootRoll = roll(25);
			if (failedLootRoll) {
				const randomItem = getRandomGimmickItem();
				await user.addItemsToBank({ items: new Bank().add(randomItem.id, 1), collectionLog: true });
				saveHalloweenState(state);
				return `Your minion fails to steal the Cursed pumpkin from ${currentHolder.usernameOrMention}, but trips over ${aOrAn(randomItem.name)} on the way.`;
			}
			saveHalloweenState(state);
			return `Your minion failed to steal the Cursed pumpkin from ${currentHolder.usernameOrMention}! They must wait 30 minutes before attempting to steal again.`;
		}

		if (options.pumpkin || (!options.steal && !options.use && !options.admin)) {
			let currentHolderName = 'None (Escaped!)';
			let runDurationStr = 'N/A';
			let immunityStr = 'Vulnerable!';
			let defenseStr = 'None';

			if (state.currentHolderId && !state.escaped) {
				const holder = await mUserFetch(state.currentHolderId);
				currentHolderName = holder.usernameOrMention;
				if (state.heldSince) {
					runDurationStr = formatDuration(now - state.heldSince);
				}
				if (state.immunityUntil && state.immunityUntil > now) {
					immunityStr = `Protected for ${formatDuration(state.immunityUntil - now)}`;
				}
				const defenses: string[] = [];
				if (state.hasScaredCrow) defenses.push('Scared-crow Active');
				if (state.greasedUntil && state.greasedUntil > now) {
					defenses.push(`Greased for ${formatDuration(state.greasedUntil - now)}`);
				}
				if (defenses.length > 0) defenseStr = defenses.join(', ');
			}

			const leaderboardMap = { ...state.totalHoldTimes };
			if (state.currentHolderId && !state.escaped && state.heldSince) {
				leaderboardMap[state.currentHolderId] =
					(leaderboardMap[state.currentHolderId] ?? 0) + (now - state.heldSince);
			}

			const sortedLeaderboard = Object.entries(leaderboardMap)
				.filter(([, timeHeld]) => timeHeld > 0)
				.sort((a, b) => b[1] - a[1])
				.slice(0, 10);

			const leaderboardLinesPromises = sortedLeaderboard.map(async ([userId, timeHeld], index) => {
				const u = await mUserFetch(userId);
				return `${index + 1}. **${u.usernameOrMention}**: ${formatDuration(timeHeld)}`;
			});
			const leaderboardLines = await Promise.all(leaderboardLinesPromises);
			const leaderboardText =
				leaderboardLines.length > 0 ? leaderboardLines.join('\n') : 'No hold times recorded yet.';

			const userTotalTime = leaderboardMap[user.id] ?? 0;
			const userTickets = state.ticketsAwarded[user.id] ?? 0;
			const userBoxes = state.boxesAwarded[user.id] ?? 0;

			const lastAttempt = state.lastStealAttempt[user.id] ?? 0;
			const cooldownRemaining = Math.max(0, Time.Minute * 30 - (now - lastAttempt));
			const cooldownStr =
				cooldownRemaining > 0 ? `On cooldown (${formatDuration(cooldownRemaining)})` : 'Ready to steal';

			const embed = new EmbedBuilder()
				.setTitle('The Cursed Pumpkin')
				.setDescription(
					`**Current Holder:** ${currentHolderName}\n` +
						`**Run Time:** ${runDurationStr}\n` +
						`**Immunity:** ${immunityStr}\n` +
						`**Defenses:** ${defenseStr}\n\n` +
						`**Top Hold Times**\n${leaderboardText}\n\n` +
						`**Your Stats**\n` +
						`• Total Time Held: ${formatDuration(userTotalTime)}\n` +
						`• Rotten Raffle Tickets: ${userTickets}\n` +
						`• Pumpkin-ish Boxes: ${userBoxes}\n` +
						`• Steal Status: ${cooldownStr}\n` +
						`• Alluring Pie Buff: ${state.hasAlluring[user.id] ? 'Active (+20%)' : 'None'}`
				);

			return { embeds: [embed] };
		}

		return 'Invalid command.';
	}
});

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
	.add('Pumpkin-ish box')
	.add('Pumpkin-ish seeds');

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
	scaredCrowAttempts?: number;
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
const CURSED_PUMPKIN_ID = 75_107;

let pumpkinLock: Promise<void> = Promise.resolve();
async function withPumpkinLock<T>(fn: () => Promise<T>): Promise<T> {
	const prev = pumpkinLock;
	let release!: () => void;
	pumpkinLock = new Promise<void>(resolve => {
		release = resolve;
	});
	await prev;
	try {
		return await fn();
	} finally {
		release();
	}
}

export async function removeAllOtherCursedPumpkins(keepHolderId: string | null) {
	const rows = await prisma.$queryRawUnsafe<{ id: string; quantity: string | number | bigint }[]>(`
SELECT id, (bank->>'${CURSED_PUMPKIN_ID}')::bigint AS quantity
FROM users
WHERE COALESCE((bank->>'${CURSED_PUMPKIN_ID}')::bigint, 0) > 0;`);

	for (const row of rows) {
		const qty = Number(row.quantity);
		if (qty <= 0) continue;
		if (keepHolderId && row.id === keepHolderId) {
			if (qty > 1) {
				const holder = await mUserFetch(row.id);
				await holder.removeItemsFromBank(new Bank().add('Cursed pumpkin', qty - 1));
			}
			continue;
		}
		const otherUser = await mUserFetch(row.id);
		const currentAmt = otherUser.bank.amount('Cursed pumpkin');
		if (currentAmt > 0) {
			await otherUser.removeItemsFromBank(new Bank().add('Cursed pumpkin', currentAmt));
		}
	}
}

const defaultState: HalloweenEventState = {
	currentHolderId: null,
	heldSince: null,
	lastTripAt: null,
	immunityUntil: null,
	greasedUntil: null,
	hasScaredCrow: false,
	scaredCrowAttempts: 0,
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
			scaredCrowAttempts: parsed.scaredCrowAttempts ?? 0,
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
	return withPumpkinLock(async () => {
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

			state.escaped = true;
			state.currentHolderId = null;
			state.heldSince = null;
			state.lastTripAt = null;
			state.immunityUntil = null;
			state.greasedUntil = null;
			state.hasScaredCrow = false;
			state.scaredCrowAttempts = 0;
			saveHalloweenState(state);

			await removeAllOtherCursedPumpkins(null);
			if (deliveryBank.length > 0) {
				await oldHolder.addItemsToBank({ items: deliveryBank, collectionLog: true });
			}

			await globalClient
				.sendMessage(Channel.GeneralChannel, {
					content: `The Cursed Pumpkin has grown restless and rotted in ${oldHolder.usernameOrMention}'s bank! It escaped and must be found again...`
				})
				.catch(noOp);
		}

		if (state.currentHolderId === user.id && !state.escaped) {
			state.lastTripAt = now;
			saveHalloweenState(state);
		}

		if (state.escaped) {
			if (roll(10)) {
				state.escaped = false;
				state.currentHolderId = user.id;
				state.heldSince = now;
				state.lastTripAt = now;
				state.immunityUntil = now + Time.Minute * 30;
				state.hasScaredCrow = false;
				state.scaredCrowAttempts = 0;
				state.greasedUntil = null;
				saveHalloweenState(state);

				await removeAllOtherCursedPumpkins(null);
				await user.sync();

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

		const lastDrop = state.tripCooldowns[user.id] ?? 0;
		if (now - lastDrop >= Time.Minute * 10) {
			if (roll(10)) {
				state.tripCooldowns[user.id] = now;
				saveHalloweenState(state);
				const ambientLoot = halloweenTripRewardTable.roll(2);
				extraItems.add(ambientLoot);
				halloweenMessages.push(`You found ${ambientLoot} during your trip!`);
			}
		}

		if (data.duration >= Time.Minute * 5) {
			if (roll(10)) {
				const gimmick = getRandomGimmickItem();
				extraItems.add(gimmick.id, 2);
				halloweenMessages.push(`You found 2x ${gimmick.name} during your trip!`);
			}
		}

		if (percentChance(20)) {
			extraItems.add('Rotten Raffle ticket', 2);
			halloweenMessages.push('Your minion found 2x Rotten raffle ticket during the trip!');
		}

		if (extraItems.length > 0 || halloweenMessages.length > 0) {
			return {
				itemsToAddWithCL: extraItems.length > 0 ? extraItems : undefined,
				contentAppendix:
					halloweenMessages.length > 0 ? `\n\n${halloweenMessages.map(m => `${m}`).join('\n')}` : undefined
			};
		}
	});
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
	run: async ({ options, user, channelId }) => {
		return withPumpkinLock(async () => {
			const now = Date.now();
			const state = getHalloweenState();

			if (options.admin) {
				if (!globalConfig.adminUserIDs.includes(user.id)) {
					return 'You do not have permission to use this command.';
				}

				const action = options.admin.action;
				const targetUser = options.admin.user ? await mUserFetch(options.admin.user.user.id) : user;

				if (action === 'spawn') {
					await removeAllOtherCursedPumpkins(targetUser.id);
					await targetUser.sync();
					if (targetUser.bank.amount('Cursed pumpkin') < 1) {
						await targetUser.addItemsToBank({
							items: new Bank().add('Cursed pumpkin', 1),
							collectionLog: true
						});
					}
					state.currentHolderId = targetUser.id;
					state.heldSince = now;
					state.lastTripAt = now;
					state.immunityUntil = now + Time.Minute * 30;
					state.escaped = false;
					state.hasScaredCrow = false;
					state.scaredCrowAttempts = 0;
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
						const { newTickets, newBoxes } = calculateAndAwardHoldRewards(
							state,
							state.currentHolderId,
							now
						);
						const rewardBank = new Bank();
						if (newTickets > 0) rewardBank.add('Rotten Raffle ticket', newTickets);
						if (newBoxes > 0) rewardBank.add('Pumpkin-ish box', newBoxes);
						if (rewardBank.length > 0) {
							await oldHolder.addItemsToBank({ items: rewardBank, collectionLog: true });
						}
						await globalClient
							.sendMessage(Channel.GeneralChannel, {
								content: `The Cursed Pumpkin has grown restless and rotted in ${oldHolder.usernameOrMention}'s bank! It escaped and must be found again...`
							})
							.catch(noOp);
					}
					await removeAllOtherCursedPumpkins(null);
					state.escaped = true;
					state.currentHolderId = null;
					state.heldSince = null;
					state.lastTripAt = null;
					state.immunityUntil = null;
					state.greasedUntil = null;
					state.hasScaredCrow = false;
					state.scaredCrowAttempts = 0;
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
					await removeAllOtherCursedPumpkins(targetUser.id);
					await targetUser.sync();
					if (targetUser.bank.amount('Cursed pumpkin') < 1) {
						await targetUser.addItemsToBank({
							items: new Bank().add('Cursed pumpkin', 1),
							collectionLog: true
						});
					}
					state.currentHolderId = targetUser.id;
					state.heldSince = now;
					state.lastTripAt = now;
					state.immunityUntil = now + Time.Minute * 30;
					state.escaped = false;
					state.hasScaredCrow = false;
					state.scaredCrowAttempts = 0;
					state.greasedUntil = null;
					saveHalloweenState(state);
					return `Set holder to ${targetUser.usernameOrMention}.`;
				}

				if (action === 'status') {
					await removeAllOtherCursedPumpkins(state.escaped ? null : state.currentHolderId);
					const fullJson = JSON.stringify(state, null, 2);
					const summary = {
						currentHolderId: state.currentHolderId,
						heldSince: state.heldSince,
						lastTripAt: state.lastTripAt,
						immunityUntil: state.immunityUntil,
						greasedUntil: state.greasedUntil,
						hasScaredCrow: state.hasScaredCrow,
						scaredCrowAttempts: state.scaredCrowAttempts,
						escaped: state.escaped,
						previousHolderId: state.previousHolderId,
						trackedHolders: Object.keys(state.totalHoldTimes).length,
						trackedCooldowns: Object.keys(state.tripCooldowns).length
					};
					const content = `\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\``;
					if (fullJson.length > 1800) {
						return {
							content,
							files: [{ buffer: Buffer.from(fullJson, 'utf-8'), name: 'cursed-pumpkin-state.json' }]
						};
					}
					return `\`\`\`json\n${fullJson}\n\`\`\``;
				}
			}

			if (options.use) {
				if (globalConfig.isProduction && channelId !== Channel.HalloweenChannel) {
					return `You can only use Halloween items in <#${Channel.HalloweenChannel}>.`;
				}

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
					state.scaredCrowAttempts = 0;
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

				const hadAlluring = Boolean(state.hasAlluring[user.id]);
				if (hadAlluring) {
					chance += 40;
					delete state.hasAlluring[user.id];
				}

				const hadScaredCrow = state.hasScaredCrow;
				const hadGreasedPumpkin = Boolean(state.greasedUntil && state.greasedUntil > now);

				if (hadGreasedPumpkin && !hadAlluring) {
					chance -= 15;
				}

				if (user.id === state.previousHolderId) {
					chance -= 30;
				}

				let crowDecayed = false;
				if (hadScaredCrow) {
					state.scaredCrowAttempts = (state.scaredCrowAttempts ?? 0) + 1;
					if (state.scaredCrowAttempts >= 3) {
						crowDecayed = true;
						state.hasScaredCrow = false;
						state.scaredCrowAttempts = 0;
					}
				}

				chance = clamp(chance, { min: 20, max: 95 });
				const succeeded = percentChance(chance);

				if (succeeded) {
					if (hadScaredCrow) {
						let protectionChance = hadGreasedPumpkin ? 90 : 70;
						if (hadAlluring) {
							protectionChance -= 25;
						}
						if (percentChance(protectionChance)) {
							state.lastStealAttempt[user.id] = now - Time.Minute * 15;
							const rewardItem = getRandomGimmickItem();
							await user.addItemsToBank({ items: new Bank().add(rewardItem.id, 2), collectionLog: true });
							saveHalloweenState(state);
							const decayNote = crowDecayed ? ' The scared-crow has decayed.' : '';
							return `Your minion encounters an awfully scared looking scarecrow on the way, so they decide to make it feel better instead of stealing from ${currentHolder.usernameOrMention}. It rewards them with 2x ${rewardItem.name}!${decayNote} Your steal cooldown has been reduced to 15 minutes.`;
						}
					}

					const { newTickets, newBoxes } = calculateAndAwardHoldRewards(state, currentHolder.id, now);
					const rewardBank = new Bank();
					if (newTickets > 0) rewardBank.add('Rotten Raffle ticket', newTickets);
					if (newBoxes > 0) rewardBank.add('Pumpkin-ish box', newBoxes);

					let consolationItem: string | null = null;
					if (roll(5)) {
						const consolationLoot = halloweenTripRewardTable.roll(2);
						consolationItem = consolationLoot.toString();
						rewardBank.add(consolationLoot);
					}

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
					state.scaredCrowAttempts = 0;
					state.greasedUntil = null;
					state.escaped = false;
					saveHalloweenState(state);

					await removeAllOtherCursedPumpkins(user.id);
					if (rewardBank.length > 0) {
						await currentHolder.sync();
						await currentHolder.addItemsToBank({ items: rewardBank, collectionLog: true });
					}
					await user.sync();
					if (user.bank.amount('Cursed pumpkin') < 1) {
						await user.addItemsToBank({ items: new Bank().add('Cursed pumpkin', 1), collectionLog: true });
					}

					let announcement = `${user.usernameOrMention} has stolen the Cursed Pumpkin from ${currentHolder.usernameOrMention}!\n${userMention(currentHolder.id)} Your minion lost the cursed pumpkin, but gained ${newTickets}x Rotten Raffle ticket and ${newBoxes}x Pumpkin-ish box!`;
					if (consolationItem) {
						announcement += `\nYour minion stole the Cursed pumpkin and it left something behind for ${currentHolder.usernameOrMention}!`;
					}

					await globalClient
						.sendMessage(Channel.Notifications, {
							content: announcement,
							allowedMentions: { users: [currentHolder.id] }
						})
						.catch(noOp);

					return `You successfully stole the Cursed Pumpkin from ${currentHolder.usernameOrMention}! You have ${formatDuration(immunityDuration)} of steal immunity.`;
				}

				state.lastStealAttempt[user.id] = now;
				const decayNote =
					hadScaredCrow && crowDecayed
						? `\n${currentHolder.usernameOrMention}'s scared-crow has decayed.`
						: '';
				if (roll(5)) {
					const failedLoot = halloweenTripRewardTable.roll(2);
					await user.addItemsToBank({ items: failedLoot, collectionLog: true });
					saveHalloweenState(state);
					return `Your minion failed to steal the Cursed Pumpkin from ${currentHolder.usernameOrMention}, but they hope this ${failedLoot} is close enough!${decayNote}`;
				}
				const failedLootRoll = roll(12);
				if (failedLootRoll) {
					const randomItem = getRandomGimmickItem();
					await user.addItemsToBank({ items: new Bank().add(randomItem.id, 2), collectionLog: true });
					saveHalloweenState(state);
					return `Your minion fails to steal the Cursed pumpkin from ${currentHolder.usernameOrMention}, but trips over 2x ${randomItem.name} on the way.${decayNote}`;
				}
				saveHalloweenState(state);
				return `Your minion failed to steal the Cursed pumpkin from ${currentHolder.usernameOrMention}! They must wait 30 minutes before attempting to steal again.${decayNote}`;
			}

			if (options.pumpkin || (!options.steal && !options.use && !options.admin)) {
				await removeAllOtherCursedPumpkins(state.escaped ? null : state.currentHolderId);

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
					if (state.hasScaredCrow) {
						const remaining = Math.max(0, 3 - (state.scaredCrowAttempts ?? 0));
						defenses.push(`Scared-crow Active (${remaining} attempt${remaining === 1 ? '' : 's'} left)`);
					}
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
							`• Alluring Pie Buff: ${state.hasAlluring[user.id] ? 'Active (+40%)' : 'None'}`
					);

				return { embeds: [embed] };
			}

			return 'Invalid command.';
		});
	}
});

import { isSuperUntradeable } from '@/lib/bso/bsoUtil.js';
import { MysteryBoxes } from '@/lib/bso/openables/tables.js';
import { LampTable } from '@/lib/bso/xpLamps.js';

import { ButtonBuilder, ButtonStyle, dateFm, time, userMention } from '@oldschoolgg/discord';
import { Events, miniID, PerkTier, sleep, Time } from '@oldschoolgg/toolkit';
import { MathRNG, randArrItem, randInt } from 'node-rng';
import { Bank } from 'oldschooljs';

import { Channel, globalConfig } from '@/lib/constants.js';
import { getApplicationEmoji, PARTY_BALLOON_COLORS, type PartyBalloonColor } from '@/lib/util/applicationEmojis.js';
import { getESTMidnightAfterDays } from '@/lib/util/estTime.js';
import itemIsTradeable from '@/lib/util/itemIsTradeable.js';
import { makeBankImage } from '@/lib/util/makeBankImage.js';
import { parseBank } from '@/lib/util/parseStringBank.js';

const BALLOONS_PER_WAVE = 20;
const WAVE_DURATION_MS = Time.Second * 25;
const WAVE_BREAK_MS = Time.Second * 6;
const LEVER_COUNTDOWN_MS = Time.Second * 5;
const THROTTLE_INTERVAL_MS = 2000;
const BALLOON_POP_COOLDOWN_MS = Time.Second * 3;

interface PartyBalloonSlot {
	index: number;
	color: PartyBalloonColor;
	popped: boolean;
	poppedBy: string | null;
	loot: Bank | null;
}

interface PartyWinRecord {
	userId: string;
	wave: number;
	loot: Bank;
}

interface PartyRoomSession {
	sessionId: string;
	mode: 'patron' | 'player';
	hostId: string;
	channelId: string;
	messageId: string;
	totalWaves: number;
	currentWave: number;
	waveActive: boolean;
	completed: boolean;
	balloons: PartyBalloonSlot[];
	lastPopTimestampByUser: Map<string, number>;
	allParticipants: Set<string>;
	winRecords: PartyWinRecord[];
	unclaimedBank: Bank;
	remainingPlayerBank: Bank | null;
	uiDirty: boolean;
	waveEndTimestampSec: number;
	resolveWaveEarly: (() => void) | null;
}

const activeSessionsById = new Map<string, PartyRoomSession>();
const activeChannelSessionIds = new Map<string, string>();

let pendingRefundSyncQueue: Promise<void> = Promise.resolve();

function enqueuePendingRefundSync(task: () => Promise<void>): Promise<void> {
	pendingRefundSyncQueue = pendingRefundSyncQueue.then(task).catch(err => {
		Logging.logError(err instanceof Error ? err : new Error(String(err)));
	});
	return pendingRefundSyncQueue;
}

export async function refundPendingPartyRooms(): Promise<void> {
	const pending = await Cache.getPartyRoomPendingRefunds();
	const entries = Object.entries(pending);
	if (entries.length === 0) return;

	for (const [sessionId, record] of entries) {
		try {
			const refundBank = new Bank(record.bank);
			if (refundBank.length > 0) {
				const host = await mUserFetch(record.hostId);
				await host.addItemsToBank({
					items: refundBank,
					collectionLog: false,
					dontAddToTempCL: true,
					neverUpdateHistory: true
				});
				Logging.logDebug(
					`Refunded ${refundBank} to ${host.username} (${host.id}) from interrupted Party Room session ${sessionId}.`
				);
			}
			await enqueuePendingRefundSync(() => Cache.deletePartyRoomPendingRefund(sessionId));
		} catch (err) {
			Logging.logError(err instanceof Error ? err : new Error(String(err)));
		}
	}
}

function getPatronPartyRoomConfig(perkTier: PerkTier): {
	waves: number;
	prizesPerWave: number;
	cooldownMs: number;
} | null {
	if (perkTier >= PerkTier.Eight) {
		return { waves: 3, prizesPerWave: 6, cooldownMs: Time.Day * 7 };
	}
	if (perkTier === PerkTier.Seven) {
		return { waves: 2, prizesPerWave: 6, cooldownMs: Time.Day * 9 };
	}
	if (perkTier === PerkTier.Six) {
		return { waves: 2, prizesPerWave: 5, cooldownMs: Time.Day * 12 };
	}
	if (perkTier === PerkTier.Five) {
		return { waves: 1, prizesPerWave: 5, cooldownMs: Time.Day * 14 };
	}
	return null;
}

function rollBotFundedBalloonPrize(): Bank {
	const r = randInt(1, 100);
	if (r <= 60) {
		return new Bank().add(MysteryBoxes.roll());
	}
	if (r <= 85) {
		return LampTable.roll();
	}
	const extra =
		randArrItem([
			'Reward casket (hard)',
			'Reward casket (elite)',
			'Reward casket (master)',
			'Dragon impling jar',
			'Lucky impling jar'
		]) ?? 'Reward casket (hard)';
	return new Bank().add(extra, 1);
}

function buildWaveBalloons(prizeBanks: Bank[]): PartyBalloonSlot[] {
	const slots: PartyBalloonSlot[] = [];
	const indices = MathRNG.shuffle(Array.from({ length: BALLOONS_PER_WAVE }, (_, i) => i));
	const prizeMap = new Map<number, Bank>();

	for (let i = 0; i < Math.min(prizeBanks.length, BALLOONS_PER_WAVE); i++) {
		prizeMap.set(indices[i], prizeBanks[i]);
	}

	for (let i = 0; i < BALLOONS_PER_WAVE; i++) {
		const color = randArrItem(PARTY_BALLOON_COLORS) ?? 'red';
		slots.push({
			index: i,
			color,
			popped: false,
			poppedBy: null,
			loot: prizeMap.get(i) ?? null
		});
	}

	return slots;
}

function buildBalloonComponents(session: PartyRoomSession, forceDisableAll = false): ButtonBuilder[] {
	return session.balloons.map(slot => {
		const btn = new ButtonBuilder().setCustomId(
			`PARTYROOM_${session.sessionId}_${session.currentWave}_${slot.index}`
		);

		if (slot.popped) {
			const burstEmoji = getApplicationEmoji(`party_balloon_${slot.color}_burst`);
			btn.setDisabled(true).setStyle(
				slot.loot && slot.loot.length > 0 ? ButtonStyle.Success : ButtonStyle.Secondary
			);
			if (burstEmoji) {
				btn.setEmoji({ id: burstEmoji.id, name: burstEmoji.name });
			} else {
				btn.setLabel('Popped');
			}
		} else {
			const unpoppedEmoji = getApplicationEmoji(`party_balloon_${slot.color}`);
			btn.setDisabled(forceDisableAll || !session.waveActive).setStyle(ButtonStyle.Secondary);
			if (unpoppedEmoji) {
				btn.setEmoji({ id: unpoppedEmoji.id, name: unpoppedEmoji.name });
			} else {
				btn.setLabel(`${slot.index + 1}`);
			}
		}

		return btn;
	});
}

function buildWaveMessageContent(session: PartyRoomSession): string {
	const remainingBalloons = session.balloons.filter(b => !b.popped).length;
	const modeLabel = session.mode === 'patron' ? 'Patron Drop Party' : 'Player Drop Party';
	return [
		`**Falador Party Room - ${modeLabel}** (Host: ${userMention(session.hostId)})`,
		`**Wave ${session.currentWave} of ${session.totalWaves}** - Ends ${time(session.waveEndTimestampSec, 'R')}`,
		`Balloons remaining in this wave: **${remainingBalloons}/${BALLOONS_PER_WAVE}** (${Math.round(BALLOON_POP_COOLDOWN_MS / 1000)}s cooldown between pops)`
	].join('\n');
}

export async function handlePartyRoomButton(
	user: MUser,
	customId: string,
	_interaction: OSInteraction
): CommandResponse {
	const parts = customId.split('_');
	if (parts.length !== 4 || parts[0] !== 'PARTYROOM') {
		return { content: 'Invalid Party Room button.', ephemeral: true };
	}

	const [, sessionId, waveStr, slotStr] = parts;
	const wave = Number(waveStr);
	const slotIndex = Number(slotStr);

	const session = activeSessionsById.get(sessionId);
	if (!session || session.completed) {
		return { content: 'This drop party has already ended.', ephemeral: true };
	}

	if (!session.waveActive || session.currentWave !== wave) {
		return { content: 'This wave of balloons is no longer active.', ephemeral: true };
	}

	if (session.mode === 'player') {
		if (user.id === session.hostId) {
			return { content: 'You cannot pop balloons in your own drop party.', ephemeral: true };
		}
		if (user.isIronman) {
			return {
				content: 'You are an ironman, so you cannot claim balloons in player-funded drop parties.',
				ephemeral: true
			};
		}
	}

	const lastPop = session.lastPopTimestampByUser.get(user.id);
	if (lastPop !== undefined) {
		const remainingMs = BALLOON_POP_COOLDOWN_MS - (Date.now() - lastPop);
		if (remainingMs > 0) {
			return {
				content: `You must wait ${(remainingMs / 1000).toFixed(1)}s before popping another balloon.`,
				ephemeral: true
			};
		}
	}

	const slot = session.balloons[slotIndex];
	if (!slot || slot.popped) {
		return { content: 'That balloon has already been popped.', ephemeral: true };
	}

	slot.popped = true;
	slot.poppedBy = user.id;
	session.lastPopTimestampByUser.set(user.id, Date.now());
	session.allParticipants.add(user.id);
	session.uiDirty = true;

	const wonLoot = slot.loot && slot.loot.length > 0 ? slot.loot.clone() : null;
	if (wonLoot) {
		session.winRecords.push({
			userId: user.id,
			wave,
			loot: wonLoot
		});
		if (session.mode === 'player' && session.remainingPlayerBank) {
			session.remainingPlayerBank.remove(wonLoot);
			const bankSnapshot = session.remainingPlayerBank.toJSON();
			void enqueuePendingRefundSync(() =>
				Cache.setPartyRoomPendingRefund(session.sessionId, {
					hostId: session.hostId,
					bank: bankSnapshot
				})
			);
		}
	}

	if (session.balloons.every(b => b.popped) && session.resolveWaveEarly) {
		session.resolveWaveEarly();
	}

	if (wonLoot) {
		await user.addItemsToBank({
			items: wonLoot,
			collectionLog: false,
			dontAddToTempCL: true,
			neverUpdateHistory: session.mode === 'player'
		});
		return {
			content: `You popped the balloon and received **${wonLoot}**.`,
			ephemeral: true
		};
	}

	return {
		content: 'You popped the balloon, but nothing was inside.',
		ephemeral: true
	};
}

async function runPartyRoomWaves({
	sessionId: providedSessionId,
	host,
	channelId,
	mode,
	wavePrizes,
	previewImage,
	playerBank
}: {
	sessionId?: string;
	host: MUser;
	channelId: string;
	mode: 'patron' | 'player';
	wavePrizes: Bank[][];
	previewImage?: { buffer: Buffer; name: string };
	playerBank?: Bank;
}): Promise<string> {
	const sessionId = providedSessionId ?? miniID(8);
	const totalWaves = wavePrizes.length;
	const leverEndSec = Math.floor((Date.now() + LEVER_COUNTDOWN_MS) / 1000);

	const initialMsg = await globalClient.sendMessage(channelId, {
		content: `${userMention(host.id)} pulled the Falador Party Room lever. Balloons will drop ${time(leverEndSec, 'R')} (${totalWaves} wave${totalWaves > 1 ? 's' : ''}).`,
		files: previewImage ? [previewImage] : undefined,
		allowedMentions: { users: [host.id] }
	});

	if (!initialMsg) {
		throw new Error('Failed to send Party Room message in this channel.');
	}

	const session: PartyRoomSession = {
		sessionId,
		mode,
		hostId: host.id,
		channelId,
		messageId: initialMsg.id,
		totalWaves,
		currentWave: 0,
		waveActive: false,
		completed: false,
		balloons: [],
		lastPopTimestampByUser: new Map(),
		allParticipants: new Set(),
		winRecords: [],
		unclaimedBank: new Bank(),
		remainingPlayerBank: mode === 'player' && playerBank ? playerBank.clone() : null,
		uiDirty: false,
		waveEndTimestampSec: 0,
		resolveWaveEarly: null
	};

	activeSessionsById.set(sessionId, session);
	activeChannelSessionIds.set(channelId, sessionId);

	void (async () => {
		try {
			await sleep(LEVER_COUNTDOWN_MS);

			for (let w = 0; w < totalWaves; w++) {
				session.currentWave = w + 1;
				session.lastPopTimestampByUser.clear();
				session.balloons = buildWaveBalloons(wavePrizes[w]);
				session.waveEndTimestampSec = Math.floor((Date.now() + WAVE_DURATION_MS) / 1000);
				session.waveActive = true;
				session.uiDirty = false;

				await globalClient
					.editMessage(channelId, initialMsg.id, {
						content: buildWaveMessageContent(session),
						components: buildBalloonComponents(session)
					})
					.catch(err => Logging.logError(err));

				await new Promise<void>(resolve => {
					let finished = false;
					const finishWave = () => {
						if (finished) return;
						finished = true;
						clearInterval(redrawInterval);
						clearTimeout(waveTimeout);
						session.resolveWaveEarly = null;
						resolve();
					};

					session.resolveWaveEarly = finishWave;

					const redrawInterval = setInterval(() => {
						if (!session.uiDirty || finished) return;
						session.uiDirty = false;
						globalClient
							.editMessage(channelId, initialMsg.id, {
								content: buildWaveMessageContent(session),
								components: buildBalloonComponents(session)
							})
							.catch(err => Logging.logError(err));
					}, THROTTLE_INTERVAL_MS);

					const waveTimeout = setTimeout(finishWave, WAVE_DURATION_MS);
				});

				session.waveActive = false;

				for (const slot of session.balloons) {
					if (!slot.popped && slot.loot && slot.loot.length > 0) {
						session.unclaimedBank.add(slot.loot);
					}
				}

				if (w < totalWaves - 1) {
					const nextWaveSec = Math.floor((Date.now() + WAVE_BREAK_MS) / 1000);
					await globalClient
						.editMessage(channelId, initialMsg.id, {
							content: `**Falador Party Room** - Wave ${session.currentWave} complete. Wave ${session.currentWave + 1} drops ${time(nextWaveSec, 'R')}.`,
							components: buildBalloonComponents(session, true)
						})
						.catch(err => Logging.logError(err));
					await sleep(WAVE_BREAK_MS);
				}
			}

			session.completed = true;

			if (mode === 'player' && session.unclaimedBank.length > 0) {
				await host.addItemsToBank({
					items: session.unclaimedBank,
					collectionLog: false,
					dontAddToTempCL: true,
					neverUpdateHistory: true
				});
			}

			if (mode === 'player') {
				await enqueuePendingRefundSync(() => Cache.deletePartyRoomPendingRefund(sessionId));
			}

			const winnerLines = session.winRecords.map(
				r => `- ${userMention(r.userId)} (Wave ${r.wave}): **${r.loot}**`
			);

			const recapLines = [
				`**Falador Party Room Finished!** (Host: ${userMention(host.id)}, Participants: ${session.allParticipants.size})`,
				...(winnerLines.length > 0 ? winnerLines : ['No prize balloons were popped.'])
			];

			if (mode === 'player' && session.unclaimedBank.length > 0) {
				recapLines.push(`Unpopped items refunded to host: **${session.unclaimedBank}**`);
			}

			const finalRecap = recapLines.join('\n').slice(0, 1950);

			await globalClient
				.editMessage(channelId, initialMsg.id, {
					content: finalRecap,
					components: []
				})
				.catch(err => Logging.logError(err));
		} catch (err) {
			Logging.logError(err instanceof Error ? err : new Error(String(err)));
		} finally {
			session.completed = true;
			activeSessionsById.delete(sessionId);
			activeChannelSessionIds.delete(channelId);
		}
	})();

	return 'You pulled the Falador Party Room lever! Balloons will drop shortly.';
}

export async function patronPartyRoomCommand(user: MUser, interaction: MInteraction): CommandResponse {
	const perkTier = await user.fetchPerkTier();
	const config = getPatronPartyRoomConfig(perkTier);
	if (!config && !user.isAdmin) {
		return 'You need to be a Tier 4 patron or higher to start a patron Falador Party Room drop party.';
	}

	const { waves, prizesPerWave, cooldownMs } = config ?? {
		waves: 2,
		prizesPerWave: 6,
		cooldownMs: Time.Day * 3
	};

	const channelId = interaction.channelId;
	const allowedChannel = Channel.GeneralChannel;
	if (globalConfig.isProduction && channelId !== allowedChannel && channelId !== '1560885061572763749') {
		return "You can't start a patron Party Room in this channel. You can only use it in <#1560885061572763749>.";
	}

	if (activeChannelSessionIds.has(channelId)) {
		return 'A Falador Party Room drop party is already active in this channel.';
	}

	const lastUse = Number(user.user.last_party_room_date ?? 0);
	const cooldownDays = Math.max(1, Math.round(cooldownMs / Time.Day));
	const nextAvailable = lastUse > 0 ? getESTMidnightAfterDays(cooldownDays, new Date(lastUse)) : null;
	if (nextAvailable && Date.now() < nextAvailable.getTime() && !user.isAdmin) {
		return `Your patron Party Room is on cooldown until midnight EST (${dateFm(nextAvailable)}).`;
	}

	await user.update({
		last_party_room_date: Date.now()
	});

	const wavePrizes: Bank[][] = [];
	const totalPrizeBank = new Bank();
	for (let w = 0; w < waves; w++) {
		const prizes: Bank[] = [];
		for (let p = 0; p < prizesPerWave; p++) {
			const prize = rollBotFundedBalloonPrize();
			prizes.push(prize);
			totalPrizeBank.add(prize);
		}
		wavePrizes.push(prizes);
	}

	const previewImage = await makeBankImage({
		bank: totalPrizeBank,
		title: `${user.username}'s Patron Party Room Drop`
	});

	return runPartyRoomWaves({
		host: user,
		channelId,
		mode: 'patron',
		wavePrizes,
		previewImage
	});
}

function splitBankIntoBalloons(totalBank: Bank, maxBalloons: number): Bank[] {
	const buckets: Bank[] = [];
	for (const [item, qty] of totalBank.items()) {
		if (qty <= 0) continue;
		if (item.id === 995 && qty >= 5) {
			const chunks = Math.min(5, maxBalloons - buckets.length || 1);
			const perChunk = Math.floor(qty / chunks);
			const remainder = qty - perChunk * chunks;
			for (let c = 0; c < chunks; c++) {
				const amount = c === 0 ? perChunk + remainder : perChunk;
				if (amount > 0) buckets.push(new Bank().add('Coins', amount));
			}
		} else if (qty > 1 && buckets.length + qty <= maxBalloons) {
			for (let i = 0; i < qty; i++) {
				buckets.push(new Bank().add(item.id, 1));
			}
		} else {
			buckets.push(new Bank().add(item.id, qty));
		}
	}

	while (buckets.length > maxBalloons) {
		const popped = buckets.pop()!;
		buckets[buckets.length - 1].add(popped);
	}

	return MathRNG.shuffle(buckets);
}

export async function playerPartyRoomCommand({
	user,
	interaction,
	channelId,
	guildId,
	itemsInput,
	search,
	filter
}: {
	user: MUser;
	interaction: MInteraction;
	channelId: string;
	guildId?: string | null;
	itemsInput?: string;
	search?: string;
	filter?: string;
}): CommandResponse {
	if (user.isIronman) {
		return 'You are an ironman, so you cannot host a player-funded drop party.';
	}

	if (!guildId && !interaction.guildId) {
		return 'You cannot start a drop party outside of a server.';
	}

	if (activeChannelSessionIds.has(channelId)) {
		return 'A Falador Party Room drop party is already active in this channel.';
	}

	const bank = parseBank({
		inputStr: itemsInput,
		inputBank: user.bankWithGP,
		excludeItems: user.user.favoriteItems,
		user,
		search,
		filters: [filter, 'tradeables'],
		maxSize: 45
	});

	if (bank.length === 0) {
		return 'You must specify valid tradeable items or GP from your bank to put in the Party Room chest.';
	}

	if (bank.items().some(i => isSuperUntradeable(i[0]) || !itemIsTradeable(i[0].id, true))) {
		return 'You cannot put untradeable items into the Falador Party Room chest.';
	}

	if (!user.bankWithGP.has(bank)) {
		return "You don't own all of those items.";
	}

	await interaction.confirmation(
		`Are you sure you want to drop these items in the Falador Party Room? Any balloons popped by other players cannot be recovered: ${bank}`
	);

	await user.sync();
	if (!user.bankWithGP.has(bank)) {
		return "You don't own all of those items.";
	}

	if (activeChannelSessionIds.has(channelId)) {
		return 'A Falador Party Room drop party is already active in this channel.';
	}

	const sessionId = miniID(8);
	await user.removeItemsFromBank(bank);
	await enqueuePendingRefundSync(() =>
		Cache.setPartyRoomPendingRefund(sessionId, {
			hostId: user.id,
			bank: bank.toJSON()
		})
	);

	if (bank.has('Coins')) {
		await ClientSettings.addToGPTaxBalance(user, bank.amount('Coins'));
	}

	globalClient.emit(
		Events.EconomyLog,
		`${user.mention}[${user.id}] started a Falador Party Room drop party with ${bank}.`
	);

	const prizeBuckets = splitBankIntoBalloons(bank, 30);
	const totalWaves = prizeBuckets.length > 10 ? 2 : 1;
	const wavePrizes: Bank[][] = [];
	if (totalWaves === 1) {
		wavePrizes.push(prizeBuckets);
	} else {
		const mid = Math.ceil(prizeBuckets.length / 2);
		wavePrizes.push(prizeBuckets.slice(0, mid), prizeBuckets.slice(mid));
	}

	try {
		const previewImage = await makeBankImage({
			bank,
			title: `${user.username}'s Party Room Drop`
		});

		return await runPartyRoomWaves({
			sessionId,
			host: user,
			channelId,
			mode: 'player',
			wavePrizes,
			previewImage,
			playerBank: bank
		});
	} catch (err) {
		await user.addItemsToBank({
			items: bank,
			collectionLog: false,
			dontAddToTempCL: true,
			neverUpdateHistory: true
		});
		await enqueuePendingRefundSync(() => Cache.deletePartyRoomPendingRefund(sessionId));
		throw err;
	}
}

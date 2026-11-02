import { isSuperUntradeable } from '@/lib/bso/bsoUtil.js';
import { Herb } from '@/lib/bso/skills/invention/groups/Herb.js';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { type APIApplicationCommandOptionChoice, userMention } from '@oldschoolgg/discord';
import { calcWhatPercent, noOp, sleep, sumArr, truncateString } from '@oldschoolgg/toolkit';
import { Bank, type Item, type ItemBank, Items } from 'oldschooljs';

import type { StringAutoComplete } from '@/discord/commands/commandOptions.js';
import { choicesOf, type ExtractOptions, filterOption, itemArr } from '@/discord/index.js';
import { globalConfig } from '@/lib/constants.js';
import { ores, secondaries, seeds } from '@/lib/data/filterables.js';
import type { RobochimpUser } from '@/lib/roboChimp.js';
import Firemaking from '@/lib/skilling/skills/firemaking.js';
import Runecraft from '@/lib/skilling/skills/runecraft.js';
import { assert } from '@/lib/util/logError.js';
import { makeBankImage } from '@/lib/util/makeBankImage.js';
import { parseBank } from '@/lib/util/parseStringBank.js';

const LOTTERIES_STATE_PATH = path.resolve('data/bso/lotteries.json');
const DEFAULT_LOTTERY_TICKET_PRICE = 10_000_000;
const DEFAULT_ITEM_VALUE_MULTIPLIER = 3;
const NO_ACTIVE_LOTTERY_MESSAGE = 'There are no active lotteries at present! Try again later!';

export const LOTTERY_BANK_HOLDER_USER_ID = globalConfig.adminUserIDs[0];
export const LOTTERY_TICKET_ITEM = Items.getOrThrow('Bank lottery ticket');
export const ROTTEN_RAFFLE_TICKET_ITEM = Items.getOrThrow('Rotten Raffle ticket');

assert(LOTTERY_TICKET_ITEM.id === 5021);
assert(ROTTEN_RAFFLE_TICKET_ITEM.id === 75_102);

const MAX_LOTTERY_TICKETS_PER_DEPOSIT = Math.floor(Number.MAX_SAFE_INTEGER / DEFAULT_LOTTERY_TICKET_PRICE);

export interface LotteryPrizeSet {
	id: string;
	name: string;
	items: ItemBank;
	winnerId: string | null;
	winnerUsername: string | null;
	drawnAt: number | null;
}

export interface LotteryTradeInRule {
	id: string;
	name?: string | null;
	cost: ItemBank;
	ticketsAwarded: number;
}

export interface LotteryGeneralPoolWinner {
	spinIndex: number;
	winnerId: string;
	winnerUsername: string | null;
	items: ItemBank;
	drawnAt: number;
}

export interface LotteryConfig {
	id: string;
	name: string;
	ticketItemId: number;
	active: boolean;
	allowIronmen: boolean;
	repeatWinDecayFactor: number;
	maxWinsPerUser: number | null;
	consumeWinningTicket: boolean;
	gpPricePerTicket: number | null;
	gpGoesIntoPool: boolean;
	gpPoolPercent: number;
	acceptsValueDeposit: boolean;
	itemValueMultiplier: number;
	valueDepositThreshold: number;
	tradeInItemsGoIntoPool: boolean;
	tradeInRules: LotteryTradeInRule[];
	prizeSets: LotteryPrizeSet[];
	generalPool: ItemBank;
	generalPoolSpins: number;
	generalPoolTaxPercent: number;
	generalPoolWinners: LotteryGeneralPoolWinner[];
	winCounts: Record<string, number>;
}

export interface LotteriesState {
	defaultLotteryId: string;
	lotteries: Record<string, LotteryConfig>;
}

export interface LotteryTicketHolder {
	id: string;
	username: string;
	tickets: number;
	priorWins: number;
	effectiveWeight: number;
}

interface LotteryItemBankTransformerArgs {
	itemBank: Bank;
	user?: MUser | null;
	robochimpUser?: RobochimpUser | null;
}

const specialPricesBeforeMultiplying = new Bank()
	.add('Monkey egg', 4_000_000_000)
	.add('Dragon egg', 9_500_000_000)
	.add('Dwarven warhammer', 37_000_500_000)
	.add('Twisted bow', 7_500_000_000)
	.add('Ring of luck', 150_000_000)
	.add('Dwarven ore', 75_000_000)
	.add('Dwarven bar', 200_000_000)
	.add('Volcanic shards', 300_000_000)
	.add('Death rune', 200)
	.add('Elder rune', 70_000)
	.add('Manta ray', 15_000)
	.add('Coal', 2000)
	.add('Raw shark', 6000)
	.add('Magic logs', 1000)
	.add('Yew logs', 300)
	.add('Rocktail', 40_000)
	.add('Runite ore', 15_000)
	.add('Adamantite ore', 12_000)
	.add('Mithril ore', 10_000)
	.add('Gold ore', 5000)
	.add('Pure essence', 1700)
	.add('Daeyalt essence', 22_000)
	.add('Amethyst', 15_000)
	.add('Uncut diamond', 15_000)
	.add('Uncut dragonstone', 25_000)
	.add('Uncut sapphire', 5000)
	.add('Uncut emerald', 7000)
	.add('Uncut ruby', 10_000)
	.add('Elder logs', 40_000)
	.add('Elder plank', 60_000)
	.add('Raw tuna', 1000)
	.add('Raw lobster', 1500)
	.add('Raw swordfish', 2000)
	.add('Raw rocktail', 35_000)
	.add('Torstol', 25_000)
	.add('Grimy torstol', 25_000)
	.add('Torstol potion (unf)', 25_000)
	.add('Toadflax', 50_000)
	.add('Grimy toadflax', 50_000)
	.add('Toadflax potion (unf)', 50_000)
	.add('Lantadyme', 50_000)
	.add('Grimy lantadyme', 50_000)
	.add('Lantadyme potion (unf)', 50_000)
	.add('Clue scroll(beginner)', 50_000)
	.add('Clue scroll(easy)', 250_000)
	.add('Clue scroll(medium)', 500_000)
	.add('Clue scroll(hard)', 300_000)
	.add('Clue scroll(elite)', 3_500_000)
	.add('Clue scroll(master)', 6_000_000)
	.add('Reward casket(beginner)', 50_000)
	.add('Reward casket(easy)', 100_000)
	.add('Reward casket(medium)', 200_000)
	.add('Reward casket(hard)', 500_000)
	.add('Reward casket(elite)', 4_000_000)
	.add('Reward casket(master)', 9_000_000)
	.add('Clue scroll(grandmaster)', 250_000_000)
	.add('Reward casket(grandmaster)', 140_000_000)
	.add('Drygore longsword', 1_230_000_000)
	.add('Offhand drygore longsword', 1_230_000_000)
	.add('Drygore mace', 1_230_000_000)
	.add('Offhand drygore mace', 1_230_000_000)
	.add('Drygore rapier', 1_230_000_000)
	.add('Offhand drygore rapier', 1_230_000_000)
	.add('Torva full helm', 800_000_000)
	.add('Torva platebody', 400_000_000)
	.add('Torva platelegs', 400_000_000)
	.add('Torva boots', 200_000_000)
	.add('Torva gloves', 200_000_000)
	.add('Pernix cowl', 800_000_000)
	.add('Pernix body', 400_000_000)
	.add('Pernix chaps', 400_000_000)
	.add('Pernix boots', 200_000_000)
	.add('Pernix gloves', 200_000_000)
	.add('Virtus mask', 800_000_000)
	.add('Virtus robe top', 400_000_000)
	.add('Virtus robe legs', 400_000_000)
	.add('Virtus boots', 200_000_000)
	.add('Virtus gloves', 200_000_000)
	.add('Virtus wand', 500_000_000)
	.add('Virtus book', 500_000_000)
	.add('Mahogany plank', 15_000)
	.add('Teak plank', 5000)
	.add('Oak plank', 2000)
	.add('Abyssal thread', 50_000_000)
	.add('Magus scroll', 150_000_000)
	.add('Abyssal cape', 750_000_000)
	.add('Dwarven blessing', 250_000_000)
	.add('Ent hide', 20_000_000)
	.add('Tradeable mystery box', 7_500_000)
	.add('Untradeable mystery box', 5_500_000)
	.add('Ignecarus dragonclaw', 50_000_000)
	.add('Blood dye', 1_500_000_000)
	.add('Ice dye', 1_500_000_000)
	.add('Shadow dye', 1_500_000_000)
	.add('Third age dye', 3_000_000_000)
	.add('Holiday mystery box', 75_000_000)
	.add('Saradomin brew(4)', 70_000)
	.add('Super restore(4)', 30_000)
	.add('Prayer potion(4)', 100_000)
	.add('Heat res. brew', 350_000)
	.add('Heat res. restore', 350_000)
	.add('Hellfire arrow', 30_000)
	.add('Mysterious seed', 5_000_000);

for (const herb of Herb.items.flatMap(i => i.item)) {
	if (!specialPricesBeforeMultiplying.has(herb.id)) {
		specialPricesBeforeMultiplying.add(herb.id, 10_000);
	}
}

for (const seed of Items.resolveFullItems(seeds)) {
	if (!specialPricesBeforeMultiplying.has(seed.id)) {
		specialPricesBeforeMultiplying.add(seed.id, (seed.price ?? 0) * 3.5);
	}
}

for (const seed of Items.resolveFullItems(secondaries)) {
	if (!specialPricesBeforeMultiplying.has(seed.id)) {
		specialPricesBeforeMultiplying.add(seed.id, (seed.price ?? 0) * 3.5);
	}
}

for (const seed of Items.resolveFullItems(ores)) {
	if (!specialPricesBeforeMultiplying.has(seed.id)) {
		specialPricesBeforeMultiplying.add(seed.id, (seed.price ?? 0) * 3.5);
	}
}

for (const seed of Runecraft.Runes.map(i => Items.getOrThrow(i.id))) {
	if (!specialPricesBeforeMultiplying.has(seed.id)) {
		specialPricesBeforeMultiplying.add(seed.id, (seed.price ?? 0) * 3.5);
	}
}

for (const seed of Firemaking.Burnables.map(i => Items.getOrThrow(i.inputLogs))) {
	if (!specialPricesBeforeMultiplying.has(seed.id)) {
		specialPricesBeforeMultiplying.add(seed.id, (seed.price ?? 0) * 3.5);
	}
}

const toDelete = ['Fire rune', 'Air rune', 'Water rune', 'Earth rune', 'Body rune', 'Mind rune', 'Eye of newt'];
for (const item of toDelete) {
	specialPricesBeforeMultiplying.remove(item, specialPricesBeforeMultiplying.amount(item));
}

const parsedPriceBank = new Bank();
for (const [item, qty] of specialPricesBeforeMultiplying.items()) {
	parsedPriceBank.add(item.id, qty * DEFAULT_ITEM_VALUE_MULTIPLIER);
}

let lotteryLock: Promise<void> = Promise.resolve();
async function withLotteryLock<T>(fn: () => Promise<T>): Promise<T> {
	const prev = lotteryLock;
	let release!: () => void;
	lotteryLock = new Promise<void>(resolve => {
		release = resolve;
	});
	await prev;
	try {
		return await fn();
	} finally {
		release();
	}
}

function createDefaultLotteries(): Record<string, LotteryConfig> {
	return {
		rotten_raffle: {
			id: 'rotten_raffle',
			name: 'Rotten Raffle',
			ticketItemId: ROTTEN_RAFFLE_TICKET_ITEM.id,
			active: false,
			allowIronmen: true,
			repeatWinDecayFactor: 0.25,
			maxWinsPerUser: null,
			consumeWinningTicket: false,
			gpPricePerTicket: null,
			gpGoesIntoPool: false,
			gpPoolPercent: 0,
			acceptsValueDeposit: false,
			itemValueMultiplier: DEFAULT_ITEM_VALUE_MULTIPLIER,
			valueDepositThreshold: DEFAULT_LOTTERY_TICKET_PRICE,
			tradeInItemsGoIntoPool: false,
			tradeInRules: [],
			prizeSets: [],
			generalPool: {},
			generalPoolSpins: 4,
			generalPoolTaxPercent: 0,
			generalPoolWinners: [],
			winCounts: {}
		},
		bank_lottery: {
			id: 'bank_lottery',
			name: 'Bank Lottery',
			ticketItemId: LOTTERY_TICKET_ITEM.id,
			active: false,
			allowIronmen: false,
			repeatWinDecayFactor: 0.5,
			maxWinsPerUser: null,
			consumeWinningTicket: false,
			gpPricePerTicket: DEFAULT_LOTTERY_TICKET_PRICE,
			gpGoesIntoPool: true,
			gpPoolPercent: 75,
			acceptsValueDeposit: false,
			itemValueMultiplier: DEFAULT_ITEM_VALUE_MULTIPLIER,
			valueDepositThreshold: DEFAULT_LOTTERY_TICKET_PRICE,
			tradeInItemsGoIntoPool: true,
			tradeInRules: [],
			prizeSets: [],
			generalPool: {},
			generalPoolSpins: 4,
			generalPoolTaxPercent: 5,
			generalPoolWinners: [],
			winCounts: {}
		}
	};
}

function createDefaultState(): LotteriesState {
	return {
		defaultLotteryId: 'rotten_raffle',
		lotteries: createDefaultLotteries()
	};
}

let memoryLotteriesState: LotteriesState | null = null;

function normalizeLotteryConfig(raw: Partial<LotteryConfig> & { id: string }): LotteryConfig {
	const fallbackTicketId = raw.id === 'bank_lottery' ? LOTTERY_TICKET_ITEM.id : ROTTEN_RAFFLE_TICKET_ITEM.id;
	return {
		id: raw.id,
		name: raw.name ?? raw.id,
		ticketItemId: raw.ticketItemId ?? fallbackTicketId,
		active: raw.active ?? false,
		allowIronmen: raw.allowIronmen ?? true,
		repeatWinDecayFactor:
			typeof raw.repeatWinDecayFactor === 'number' && Number.isFinite(raw.repeatWinDecayFactor)
				? Math.max(0, Math.min(1, raw.repeatWinDecayFactor))
				: 0.25,
		maxWinsPerUser:
			typeof raw.maxWinsPerUser === 'number' && raw.maxWinsPerUser > 0 ? Math.floor(raw.maxWinsPerUser) : null,
		consumeWinningTicket: Boolean(raw.consumeWinningTicket),
		gpPricePerTicket:
			typeof raw.gpPricePerTicket === 'number' && raw.gpPricePerTicket > 0
				? Math.floor(raw.gpPricePerTicket)
				: null,
		gpGoesIntoPool: raw.gpGoesIntoPool ?? false,
		gpPoolPercent:
			typeof raw.gpPoolPercent === 'number' ? Math.max(0, Math.min(100, Math.floor(raw.gpPoolPercent))) : 75,
		acceptsValueDeposit: Boolean(raw.acceptsValueDeposit),
		itemValueMultiplier:
			typeof raw.itemValueMultiplier === 'number' && raw.itemValueMultiplier > 0
				? raw.itemValueMultiplier
				: DEFAULT_ITEM_VALUE_MULTIPLIER,
		valueDepositThreshold:
			typeof raw.valueDepositThreshold === 'number' && raw.valueDepositThreshold > 0
				? Math.floor(raw.valueDepositThreshold)
				: DEFAULT_LOTTERY_TICKET_PRICE,
		tradeInItemsGoIntoPool: Boolean(raw.tradeInItemsGoIntoPool),
		tradeInRules: Array.isArray(raw.tradeInRules)
			? raw.tradeInRules.map(r => ({
					id: r.id,
					name: r.name ?? null,
					cost: r.cost ?? {},
					ticketsAwarded: r.ticketsAwarded
				}))
			: [],
		prizeSets: Array.isArray(raw.prizeSets)
			? raw.prizeSets.map(s => ({
					id: s.id,
					name: s.name,
					items: s.items ?? {},
					winnerId: s.winnerId ?? null,
					winnerUsername: s.winnerUsername ?? null,
					drawnAt: s.drawnAt ?? null
				}))
			: [],
		generalPool: raw.generalPool ?? {},
		generalPoolSpins:
			typeof raw.generalPoolSpins === 'number' && raw.generalPoolSpins > 0 ? Math.floor(raw.generalPoolSpins) : 4,
		generalPoolTaxPercent:
			typeof raw.generalPoolTaxPercent === 'number'
				? Math.max(0, Math.min(100, Math.floor(raw.generalPoolTaxPercent)))
				: 0,
		generalPoolWinners: Array.isArray(raw.generalPoolWinners) ? raw.generalPoolWinners : [],
		winCounts: raw.winCounts ?? {}
	};
}

export function getLotteriesState(): LotteriesState {
	if (process.env.TEST) {
		if (!memoryLotteriesState) {
			memoryLotteriesState = createDefaultState();
		}
		return structuredClone(memoryLotteriesState);
	}
	if (!existsSync(LOTTERIES_STATE_PATH)) {
		return createDefaultState();
	}
	try {
		const raw = readFileSync(LOTTERIES_STATE_PATH, 'utf-8');
		const parsed = JSON.parse(raw) as Partial<LotteriesState>;
		const defaults = createDefaultLotteries();
		const mergedLotteries: Record<string, LotteryConfig> = {};

		for (const [id, cfg] of Object.entries(defaults)) {
			mergedLotteries[id] = normalizeLotteryConfig({ ...cfg, ...(parsed.lotteries?.[id] ?? {}), id });
		}
		if (parsed.lotteries) {
			for (const [id, cfg] of Object.entries(parsed.lotteries)) {
				if (!mergedLotteries[id] && cfg) {
					mergedLotteries[id] = normalizeLotteryConfig({ ...cfg, id });
				}
			}
		}

		return {
			defaultLotteryId:
				parsed.defaultLotteryId && mergedLotteries[parsed.defaultLotteryId]
					? parsed.defaultLotteryId
					: 'rotten_raffle',
			lotteries: mergedLotteries
		};
	} catch {
		return createDefaultState();
	}
}

export function saveLotteriesState(state: LotteriesState): void {
	if (process.env.TEST) {
		memoryLotteriesState = structuredClone(state);
		return;
	}
	const dir = path.dirname(LOTTERIES_STATE_PATH);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	writeFileSync(LOTTERIES_STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
}

export function resetMemoryLotteriesStateForTests(): void {
	memoryLotteriesState = createDefaultState();
}

export function normalizeLotteryId(input: string): string {
	return input
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

export function resolveLotteryFromState(state: LotteriesState, query?: string | null): LotteryConfig {
	const all = Object.values(state.lotteries);
	if (query && query.trim().length > 0) {
		const trimmed = query.trim();
		const normalized = normalizeLotteryId(trimmed);
		const lower = trimmed.toLowerCase();

		if (state.lotteries[trimmed]) return state.lotteries[trimmed];
		if (state.lotteries[normalized]) return state.lotteries[normalized];

		const byName = all.find(l => l.name.toLowerCase() === lower || l.id.toLowerCase() === lower);
		if (byName) return byName;

		const maybeItem = Items.getItem(trimmed);
		if (maybeItem) {
			const byTicket = all.find(l => l.ticketItemId === maybeItem.id);
			if (byTicket) return byTicket;
		}

		const bySubstring = all.find(
			l => l.name.toLowerCase().includes(lower) || l.id.toLowerCase().includes(normalized)
		);
		if (bySubstring) return bySubstring;
	}

	const defaultLotto = state.lotteries[state.defaultLotteryId];
	if (defaultLotto?.active) return defaultLotto;

	const firstActive = all.find(l => l.active);
	if (firstActive) return firstActive;

	return defaultLotto ?? all[0]!;
}

export function resolveActiveLotteryForPlayer(state: LotteriesState, query?: string | null): LotteryConfig | null {
	const activeLotteries = Object.values(state.lotteries).filter(l => l.active);
	if (activeLotteries.length === 0) return null;

	if (query && query.trim().length > 0) {
		const resolved = resolveLotteryFromState(state, query);
		return resolved.active ? resolved : null;
	}

	const defaultLotto = state.lotteries[state.defaultLotteryId];
	if (defaultLotto?.active) return defaultLotto;

	return activeLotteries[0] ?? null;
}

export function calcEffectiveTicketWeight({
	baseTickets,
	priorWins,
	repeatWinDecayFactor,
	maxWinsPerUser
}: {
	baseTickets: number;
	priorWins: number;
	repeatWinDecayFactor: number;
	maxWinsPerUser: number | null;
}): number {
	if (!Number.isFinite(baseTickets) || baseTickets <= 0) return 0;
	if (maxWinsPerUser !== null && maxWinsPerUser > 0 && priorWins >= maxWinsPerUser) {
		return 0;
	}
	if (priorWins <= 0) return baseTickets;
	const clampedDecay = Math.max(0, Math.min(1, repeatWinDecayFactor));
	if (clampedDecay === 0) return 0;
	return baseTickets * Math.pow(clampedDecay, priorWins);
}

export function buildTicketHoldersWithWeights(
	rawHolders: { id: string; username?: string | null; tickets: number }[],
	lottery: Pick<LotteryConfig, 'repeatWinDecayFactor' | 'maxWinsPerUser' | 'winCounts'>
): LotteryTicketHolder[] {
	return rawHolders
		.filter(h => h.tickets > 0)
		.map(h => {
			const priorWins = lottery.winCounts[h.id] ?? 0;
			const effectiveWeight = calcEffectiveTicketWeight({
				baseTickets: h.tickets,
				priorWins,
				repeatWinDecayFactor: lottery.repeatWinDecayFactor,
				maxWinsPerUser: lottery.maxWinsPerUser
			});
			return {
				id: h.id,
				username: h.username && h.username.trim().length > 0 ? h.username : `User_${h.id.slice(-4)}`,
				tickets: h.tickets,
				priorWins,
				effectiveWeight
			};
		})
		.sort((a, b) => b.tickets - a.tickets || a.id.localeCompare(b.id));
}

export function pickWeightedTicketHolder(
	holders: LotteryTicketHolder[],
	randFloatFn: (min: number, max: number) => number = (min, max) => min + Math.random() * (max - min)
): LotteryTicketHolder | null {
	const eligible = holders.filter(h => h.effectiveWeight > 0);
	if (eligible.length === 0) return null;
	const totalWeight = sumArr(eligible.map(h => h.effectiveWeight));
	if (totalWeight <= 0) return null;

	let rollValue = randFloatFn(0, totalWeight);
	for (const holder of eligible) {
		if (rollValue < holder.effectiveWeight) {
			return holder;
		}
		rollValue -= holder.effectiveWeight;
	}
	return eligible[eligible.length - 1] ?? null;
}

export async function fetchLotteryTicketHolders(lottery: LotteryConfig): Promise<LotteryTicketHolder[]> {
	const ticketItemId = Number(lottery.ticketItemId);
	if (!Number.isSafeInteger(ticketItemId) || ticketItemId <= 0) {
		return [];
	}

	const rows = await prisma.$queryRawUnsafe<
		{ id: string; username: string | null; quantity: string | number | bigint; ironman: boolean }[]
	>(`
SELECT id, username, (bank->>'${ticketItemId}')::bigint AS quantity, "minion.ironman" AS ironman
FROM users
WHERE COALESCE((bank->>'${ticketItemId}')::bigint, 0) > 0
ORDER BY quantity DESC, id ASC;`);

	const filtered = rows
		.filter(r => (lottery.allowIronmen ? true : !r.ironman))
		.map(r => ({
			id: r.id,
			username: r.username,
			tickets: Number(r.quantity)
		}))
		.filter(r => Number.isFinite(r.tickets) && r.tickets > 0);

	return buildTicketHoldersWithWeights(filtered, lottery);
}

export function getCombinedLotteryPrizeBank(lottery: LotteryConfig, includeDrawnSets = false): Bank {
	const combined = new Bank(lottery.generalPool);
	for (const set of lottery.prizeSets) {
		if (!includeDrawnSets && set.winnerId) continue;
		combined.add(set.items);
	}
	return combined;
}

export async function isLotteryActive(lotteryId?: string): Promise<boolean> {
	const state = getLotteriesState();
	if (lotteryId) {
		const resolved = resolveLotteryFromState(state, lotteryId);
		return resolved.active;
	}
	const anyStateActive = Object.values(state.lotteries).some(l => l.active);
	if (anyStateActive) return true;
	const result = await ClientSettings.fetch({ lottery_is_active: true });
	return result.lottery_is_active;
}

function getPriceOfItem(item: Item, lottery?: LotteryConfig) {
	const ticketId = lottery?.ticketItemId ?? LOTTERY_TICKET_ITEM.id;
	const ticketPrice = lottery?.valueDepositThreshold ?? DEFAULT_LOTTERY_TICKET_PRICE;
	const multiplier = lottery?.itemValueMultiplier ?? DEFAULT_ITEM_VALUE_MULTIPLIER;

	if (item.id === ticketId) {
		return ticketPrice;
	}
	if (parsedPriceBank.has(item.id)) {
		const baseSpecial = specialPricesBeforeMultiplying.amount(item.id);
		return Math.floor(baseSpecial * multiplier);
	}
	return Math.floor((item.price ?? 0) * multiplier);
}

async function resolveLotteryItemBankTransformerArgs({
	user,
	robochimpUser
}: Pick<LotteryItemBankTransformerArgs, 'user' | 'robochimpUser'>) {
	if (!user && !robochimpUser) {
		throw new Error('Either user or robochimpUser must be provided to transform lottery item input.');
	}
	const resolvedUser = user ?? (await mUserFetch(robochimpUser!.id.toString()));
	const resolvedRobochimpUser = robochimpUser ?? (await Cache.getRoboChimpUser(resolvedUser.id));
	return { user: resolvedUser, robochimpUser: resolvedRobochimpUser };
}

const LOTTERY_ITEM_BANK_TRANSFORMER = async (args: LotteryItemBankTransformerArgs): Promise<Bank> => {
	await resolveLotteryItemBankTransformerArgs(args);
	return args.itemBank.clone();
};

function removeIneligibleLotteryItems(input: Bank, ticketItemId: number) {
	const cleaned = input.clone();
	for (const [item] of cleaned.items()) {
		if (isSuperUntradeable(item.id) || item.id === ticketItemId || item.name === 'Coins') {
			cleaned.clear(item);
		}
	}
	return cleaned;
}

function validatePositiveLotteryBank(bank: Bank, label: string) {
	const errors = bank.validate();
	if (errors.length > 0) {
		throw new Error(`Invalid ${label}: ${errors.join(', ')}`);
	}
	for (const [item, quantity] of bank.items()) {
		if (!Number.isFinite(quantity) || quantity < 1) {
			throw new Error(`Invalid ${label}: ${quantity}x ${item.name}`);
		}
	}
}

function calcLotteryBankValue(bank: Bank, lottery?: LotteryConfig) {
	let totalPrice = 0;
	for (const [item, quantity] of bank.items()) {
		totalPrice += getPriceOfItem(item, lottery) * quantity;
	}
	return totalPrice;
}

export async function addToLotteryBank(user: MUser, bankToAdd: Bank) {
	validatePositiveLotteryBank(bankToAdd, 'lottery bank input');
	return user.transactItems({
		itemsToAdd: bankToAdd,
		collectionLog: false,
		filterLoot: false,
		neverUpdateHistory: true,
		otherUpdates: syncedUser => ({
			lottery_input: new Bank(syncedUser.user.lottery_input as ItemBank).add(bankToAdd).toJSON()
		})
	});
}

export async function addToLotteryPrizePool(bankToAdd: Bank, lotteryQuery?: string) {
	validatePositiveLotteryBank(bankToAdd, 'lottery prize pool input');
	return withLotteryLock(async () => {
		const state = getLotteriesState();
		const lottery = resolveLotteryFromState(state, lotteryQuery);
		const updatedPool = new Bank(lottery.generalPool).add(bankToAdd);
		lottery.generalPool = updatedPool.toJSON();
		state.lotteries[lottery.id] = lottery;
		saveLotteriesState(state);
		return lottery;
	});
}

export async function getLotteryBank(lotteryQuery?: string) {
	const state = getLotteriesState();
	const lottery = resolveLotteryFromState(state, lotteryQuery);
	const holders = await fetchLotteryTicketHolders(lottery);
	const totalLoot = getCombinedLotteryPrizeBank(lottery, false);
	const totalTickets = sumArr(holders.map(i => i.tickets));
	const users = holders.map(h => ({
		id: h.id,
		username: h.username,
		lotteryInput: new Bank().add(lottery.ticketItemId, h.tickets),
		tickets: h.tickets,
		priorWins: h.priorWins,
		effectiveWeight: h.effectiveWeight
	}));
	return {
		lottery,
		totalLoot,
		users,
		totalTickets
	};
}

function formatDecayExplanation(lottery: LotteryConfig): string {
	if (lottery.maxWinsPerUser === 1 || lottery.repeatWinDecayFactor === 0) {
		return 'Max 1 win per player';
	}
	const pct = Math.round(lottery.repeatWinDecayFactor * 100);
	const capPart = lottery.maxWinsPerUser ? ` (max ${lottery.maxWinsPerUser} wins)` : '';
	if (pct === 100) {
		return `Unchanged after winning${capPart}`;
	}
	return `${pct}% ticket weight per prior win${capPart}`;
}

function formatAdminLotterySummary(lottery: LotteryConfig): string {
	const ticketItem = Items.getOrThrow(lottery.ticketItemId);
	const undrawnSets = lottery.prizeSets.filter(s => !s.winnerId).length;
	const drawnSets = lottery.prizeSets.filter(s => Boolean(s.winnerId)).length;
	const poolBank = new Bank(lottery.generalPool);

	return [
		`**${lottery.name}**`,
		`- **Status:** ${lottery.active ? 'Active' : 'Inactive'}`,
		`- **Ticket Item:** ${ticketItem.name}`,
		`- **Ironmen Allowed:** ${lottery.allowIronmen ? 'Yes' : 'No'}`,
		`- **Repeat Win Scaling:** ${formatDecayExplanation(lottery)}`,
		`- **Prize Sets:** ${undrawnSets} undrawn (${drawnSets} drawn)`,
		`- **General Pool:** ${poolBank.length > 0 ? `${poolBank.toString()} (${lottery.generalPoolSpins} draw shares)` : 'Empty'}`,
		`- **GP Purchase Price:** ${lottery.gpPricePerTicket ? `${lottery.gpPricePerTicket.toLocaleString()} GP per ticket` : 'Disabled'}`,
		`- **Value Item Deposits:** ${lottery.acceptsValueDeposit ? `Enabled (${lottery.itemValueMultiplier}x multiplier)` : 'Disabled'}`,
		`- **Trade-In Rules:** ${lottery.tradeInRules.length} configured (${lottery.tradeInItemsGoIntoPool ? 'Added to pool' : 'Sunk'})`
	].join('\n');
}

export function formatTradeInRuleLabel(
	rule: LotteryTradeInRule,
	ticketItemId: number,
	includeMarkdown = false
): string {
	const ticketItem = Items.getOrThrow(ticketItemId);
	const costBank = new Bank(rule.cost);
	const exchangeText = `${costBank.toString()}: ${rule.ticketsAwarded.toLocaleString()}x ${ticketItem.name}`;
	if (rule.name && rule.name.trim().length > 0) {
		return includeMarkdown ? `**${rule.name}**: ${exchangeText}` : `${rule.name}: ${exchangeText}`;
	}
	return includeMarkdown
		? `**${costBank.toString()}**: ${rule.ticketsAwarded.toLocaleString()}x ${ticketItem.name}`
		: exchangeText;
}

function formatCandidateMention(candidate: LotteryTicketHolder): string {
	return userMention(candidate.id);
}

export function buildHypeRollFrames({
	lottery,
	prizeTitle,
	prizeBank,
	holders,
	winner,
	steps = 4
}: {
	lottery: LotteryConfig;
	prizeTitle: string;
	prizeBank: Bank;
	holders: LotteryTicketHolder[];
	winner: LotteryTicketHolder;
	steps?: number;
}): string[] {
	const ticketItem = Items.getOrThrow(lottery.ticketItemId);
	const totalTickets = sumArr(holders.map(h => h.tickets));
	const totalEffectiveWeight = sumArr(holders.map(h => h.effectiveWeight));
	const eligibleCount = holders.filter(h => h.effectiveWeight > 0).length;
	const winnerChance =
		totalEffectiveWeight > 0 ? calcWhatPercent(winner.effectiveWeight, totalEffectiveWeight).toFixed(2) : '0.00';

	const stripLength = steps + 5;
	const winnerReelIndex = steps + 1;
	const reelStrip: LotteryTicketHolder[] = [];

	for (let i = 0; i < stripLength; i++) {
		if (i === winnerReelIndex) {
			reelStrip.push(winner);
		} else {
			const picked = pickWeightedTicketHolder(holders) ?? winner;
			reelStrip.push(picked);
		}
	}

	const formatCandidateSlot = (candidate: LotteryTicketHolder, isPointer: boolean) => {
		const mentionStr = formatCandidateMention(candidate);
		const line = `${mentionStr} (${candidate.tickets.toLocaleString()} tickets)`;
		if (isPointer) {
			return `**>> ${line} <<**`;
		}
		return `${line}`;
	};

	const frames: string[] = [];

	frames.push(
		[
			`**${lottery.name.toUpperCase()} - DRAWING PRIZE**`,
			`**Prize:** ${prizeTitle}`,
			`**Items:** ${prizeBank.toString()}`,
			'',
			`Drawing a ticket from **${totalTickets.toLocaleString()}** total tickets across **${eligibleCount.toLocaleString()}** players...`
		].join('\n')
	);

	for (let step = 0; step < steps; step++) {
		const windowItems = [
			reelStrip[step + 2] ?? winner,
			reelStrip[step + 1] ?? winner,
			reelStrip[step] ?? winner,
			reelStrip[Math.max(0, step - 1)] ?? winner,
			reelStrip[Math.max(0, step - 2)] ?? winner
		];

		if (step > 0) {
			windowItems[0] = reelStrip[step + 3] ?? winner;
			windowItems[1] = reelStrip[step + 2] ?? winner;
			windowItems[2] = reelStrip[step + 1] ?? winner;
			windowItems[3] = reelStrip[step] ?? winner;
			windowItems[4] = reelStrip[Math.max(0, step - 1)] ?? winner;
		}

		const reelLines = windowItems.map((c, idx) => formatCandidateSlot(c, idx === 2)).join('\n');

		frames.push(
			[
				`**${lottery.name.toUpperCase()} - DRAWING PRIZE**`,
				`**Prize:** ${prizeTitle}`,
				`**Items:** ${prizeBank.toString()}`,
				'',
				`Rolling tickets... [Step ${step + 1}/${steps}]`,
				'',
				reelLines
			].join('\n')
		);
	}

	frames.push(
		[
			`**${lottery.name.toUpperCase()} - WINNER SELECTED**`,
			`**Prize:** ${prizeTitle}`,
			`**Items:** ${prizeBank.toString()}`,
			'',
			`**Winner:** ${formatCandidateMention(winner)}`,
			`**Tickets Held:** ${winner.tickets.toLocaleString()}x ${ticketItem.name} (Win Odds: **${winnerChance}%**)`,
			`**Prize Delivered:** ${prizeBank.toString()}`
		].join('\n')
	);

	return frames;
}

function findRawOptionValue(options: StringAutoComplete['rawOptions'], optionName: string): string | null {
	for (const option of options ?? []) {
		if (option.name === optionName && 'value' in option && typeof option.value === 'string') {
			return option.value;
		}
		if ('options' in option) {
			const nested = findRawOptionValue(option.options, optionName);
			if (nested !== null) {
				return nested;
			}
		}
	}
	return null;
}

const playerLotteryAutocomplete = async ({
	value
}: StringAutoComplete): Promise<APIApplicationCommandOptionChoice<string>[]> => {
	const state = getLotteriesState();
	const q = value.toLowerCase();
	return Object.values(state.lotteries)
		.filter(l => l.active)
		.filter(l => !q || l.id.toLowerCase().includes(q) || l.name.toLowerCase().includes(q))
		.slice(0, 25)
		.map(l => {
			const ticketItem = Items.getItem(l.ticketItemId);
			return {
				name: truncateString(`${l.name} (${ticketItem?.name ?? 'Ticket'})`, 100),
				value: l.name
			};
		});
};

function isLotteryAdmin(user: MUser): boolean {
	return globalConfig.adminUserIDs.includes(user.id) || user.isAdmin;
}

const adminLotteryAutocomplete = async ({
	value,
	user
}: StringAutoComplete): Promise<APIApplicationCommandOptionChoice<string>[]> => {
	if (!isLotteryAdmin(user)) return [];
	const state = getLotteriesState();
	const q = value.toLowerCase();
	return Object.values(state.lotteries)
		.filter(l => !q || l.id.toLowerCase().includes(q) || l.name.toLowerCase().includes(q))
		.slice(0, 25)
		.map(l => {
			const ticketItem = Items.getItem(l.ticketItemId);
			const isDefault = state.defaultLotteryId === l.id ? ', Default' : '';
			return {
				name: truncateString(
					`${l.name} [${l.active ? 'Active' : 'Inactive'}${isDefault} - ${ticketItem?.name ?? l.ticketItemId}]`,
					100
				),
				value: l.id
			};
		});
};

const tradeInRuleAutocomplete = async ({
	value,
	user,
	rawOptions
}: StringAutoComplete): Promise<APIApplicationCommandOptionChoice<string>[]> => {
	const state = getLotteriesState();
	const lotteryInput = findRawOptionValue(rawOptions, 'lottery');
	const lottery = resolveLotteryFromState(state, lotteryInput);
	const q = value.toLowerCase();

	return lottery.tradeInRules
		.map(rule => {
			const label = formatTradeInRuleLabel(rule, lottery.ticketItemId, false);
			const costBank = new Bank(rule.cost);
			const owns = user.bankWithGP.has(costBank);
			const ruleDisplay = rule.name && rule.name.trim().length > 0 ? rule.name : label;
			return {
				name: truncateString(`${label} ${owns ? '(Available)' : '(Missing items)'}`, 100),
				value: ruleDisplay
			};
		})
		.filter(choice => !q || choice.name.toLowerCase().includes(q) || choice.value.toLowerCase().includes(q))
		.slice(0, 25);
};

const prizeSetAutocomplete = async ({
	value,
	user,
	rawOptions
}: StringAutoComplete): Promise<APIApplicationCommandOptionChoice<string>[]> => {
	if (!isLotteryAdmin(user)) return [];
	const state = getLotteriesState();
	const lotteryInput = findRawOptionValue(rawOptions, 'lottery');
	const lottery = resolveLotteryFromState(state, lotteryInput);
	const q = value.toLowerCase();

	const baseChoices: APIApplicationCommandOptionChoice<string>[] = [
		{ name: 'All Undrawn Sets', value: 'all_undrawn' },
		{ name: 'All Sets (Including Drawn)', value: 'all' }
	];

	for (const set of lottery.prizeSets) {
		const status = set.winnerId ? `Drawn: ${set.winnerUsername ?? set.winnerId}` : 'Undrawn';
		baseChoices.push({
			name: truncateString(`${set.name} (${status}): ${new Bank(set.items).toString()}`, 100),
			value: set.id
		});
	}

	return baseChoices
		.filter(c => !q || c.name.toLowerCase().includes(q) || c.value.toLowerCase().includes(q))
		.slice(0, 25);
};

const drawTargetAutocomplete = async ({
	value,
	user,
	rawOptions
}: StringAutoComplete): Promise<APIApplicationCommandOptionChoice<string>[]> => {
	if (!isLotteryAdmin(user)) return [];
	const state = getLotteriesState();
	const lotteryInput = findRawOptionValue(rawOptions, 'lottery');
	const lottery = resolveLotteryFromState(state, lotteryInput);
	const q = value.toLowerCase();

	const choices: APIApplicationCommandOptionChoice<string>[] = [
		{ name: 'Next Undrawn Prize Set(s)', value: 'next_set' },
		{ name: 'All Remaining Undrawn Prize Sets', value: 'all_sets' },
		{ name: `General Prize Pool (${lottery.generalPoolSpins} share(s) configured)`, value: 'general_pool' }
	];

	for (const set of lottery.prizeSets.filter(s => !s.winnerId)) {
		choices.push({
			name: truncateString(`${set.name}: ${new Bank(set.items).toString()}`, 100),
			value: set.id
		});
	}

	return choices
		.filter(c => !q || c.name.toLowerCase().includes(q) || c.value.toLowerCase().includes(q))
		.slice(0, 25);
};

async function executeAnimatedDraw({
	channelId,
	interaction,
	lottery,
	prizeTitle,
	prizeBank,
	holders,
	winner,
	instant
}: {
	channelId: string;
	interaction: OSInteraction;
	lottery: LotteryConfig;
	prizeTitle: string;
	prizeBank: Bank;
	holders: LotteryTicketHolder[];
	winner: LotteryTicketHolder;
	instant: boolean;
}) {
	const frames = buildHypeRollFrames({
		lottery,
		prizeTitle,
		prizeBank,
		holders,
		winner,
		steps: 4
	});
	const finalFrame = frames[frames.length - 1]!;
	const bankImage = await makeBankImage({
		bank: prizeBank,
		title: `${lottery.name}: ${prizeTitle}`
	});

	if (instant || process.env.TEST) {
		await globalClient
			.sendMessage(channelId, {
				content: finalFrame,
				files: [bankImage],
				allowedMentions: { users: [winner.id] }
			})
			.catch(noOp);
		return finalFrame;
	}

	const sentMessage = await globalClient
		.sendMessage(channelId, {
			content: frames[0]!,
			files: [bankImage],
			allowedMentions: { users: [] }
		})
		.catch(() => null);

	const stepDelays = [1000, 1200, 1400, 1700, 2100];

	if (sentMessage) {
		for (let i = 1; i < frames.length; i++) {
			await sleep(stepDelays[i - 1] ?? 1400);
			await globalClient
				.editMessage(channelId, sentMessage.id, {
					content: frames[i]!,
					allowedMentions: { users: [] }
				})
				.catch(noOp);
		}
	} else {
		await interaction.reply({
			content: frames[0]!,
			files: [bankImage],
			allowedMentions: { users: [] }
		});
		for (let i = 1; i < frames.length; i++) {
			await sleep(stepDelays[i - 1] ?? 1400);
			await interaction.reply({
				content: frames[i]!,
				allowedMentions: { users: [] }
			});
		}
	}

	return finalFrame;
}

function findMatchingTradeInRule(lottery: LotteryConfig, ruleQuery: string): LotteryTradeInRule | undefined {
	const q = ruleQuery.trim().toLowerCase();
	return lottery.tradeInRules.find(
		r =>
			r.id.toLowerCase() === q ||
			r.name?.trim().toLowerCase() === q ||
			formatTradeInRuleLabel(r, lottery.ticketItemId, false).toLowerCase() === q ||
			Boolean(r.name?.toLowerCase().includes(q)) ||
			formatTradeInRuleLabel(r, lottery.ticketItemId, false).toLowerCase().includes(q)
	);
}

export const lotteryCommand = defineCommand({
	name: 'lottery',
	description: 'Participate in lotteries and raffles, trade items for tickets, or view prize pools.',
	options: [
		{
			type: 'Subcommand',
			name: 'info',
			description: 'View the active lottery prize sets, prize pool, your tickets, and trade-in options.',
			options: [
				{
					type: 'String',
					name: 'lottery',
					description: 'The lottery or raffle to view (defaults to the active lottery).',
					required: false,
					autocomplete: playerLotteryAutocomplete
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'trade_in',
			description: 'Trade items or GP in for lottery tickets.',
			options: [
				{
					type: 'String',
					name: 'rule',
					description: 'The trade-in option to use.',
					required: true,
					autocomplete: tradeInRuleAutocomplete
				},
				{
					type: 'Integer',
					name: 'quantity',
					description: 'How many times to perform this trade-in (default: 1).',
					required: false,
					min_value: 1,
					max_value: 100_000
				},
				{
					type: 'String',
					name: 'lottery',
					description: 'The lottery to trade in for (defaults to the active lottery).',
					required: false,
					autocomplete: playerLotteryAutocomplete
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'buy_tickets',
			description: 'Buy lottery tickets directly with GP.',
			options: [
				{
					type: 'Integer',
					name: 'quantity',
					description: 'The number of tickets to buy.',
					required: true,
					min_value: 1,
					max_value: MAX_LOTTERY_TICKETS_PER_DEPOSIT
				},
				{
					type: 'String',
					name: 'lottery',
					description: 'The lottery to buy tickets for (defaults to the active lottery).',
					required: false,
					autocomplete: playerLotteryAutocomplete
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'deposit_items',
			description: 'Deposit items into a value-based lottery to receive tickets.',
			options: [
				{
					type: 'String',
					name: 'items',
					description: 'The items you want to put in.',
					required: false
				},
				filterOption,
				{
					type: 'String',
					name: 'search',
					description: 'A search query for items in your bank to put in.',
					required: false
				},
				{
					type: 'String',
					name: 'lottery',
					description: 'The lottery to deposit items into (defaults to the active lottery).',
					required: false,
					autocomplete: playerLotteryAutocomplete
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'prices',
			description: 'View the custom item prices for value-based lottery deposits.'
		}
	],
	run: async ({ user, options, interaction }) => {
		const state = getLotteriesState();
		const selectedLotteryQuery =
			options.info?.lottery ??
			options.trade_in?.lottery ??
			options.buy_tickets?.lottery ??
			options.deposit_items?.lottery ??
			null;
		const lottery = resolveActiveLotteryForPlayer(state, selectedLotteryQuery);

		if (!lottery) {
			return NO_ACTIVE_LOTTERY_MESSAGE;
		}

		if (options.prices) {
			return { files: [await makeBankImage({ bank: parsedPriceBank, title: 'Prices' })] };
		}

		const ticketItem = Items.getOrThrow(lottery.ticketItemId);

		if (!options.buy_tickets && !options.deposit_items && !options.trade_in) {
			const holders = await fetchLotteryTicketHolders(lottery);
			const totalTickets = sumArr(holders.map(h => h.tickets));
			const totalEffectiveWeight = sumArr(holders.map(h => h.effectiveWeight));
			const userEntry = holders.find(h => h.id === user.id);
			const userTickets = userEntry?.tickets ?? user.bank.amount(ticketItem.id);
			const userPriorWins = lottery.winCounts[user.id] ?? 0;
			const userEffectiveWeight =
				userEntry?.effectiveWeight ??
				calcEffectiveTicketWeight({
					baseTickets: userTickets,
					priorWins: userPriorWins,
					repeatWinDecayFactor: lottery.repeatWinDecayFactor,
					maxWinsPerUser: lottery.maxWinsPerUser
				});

			const effectiveChance =
				userEffectiveWeight <= 0 || totalEffectiveWeight <= 0
					? '0'
					: calcWhatPercent(userEffectiveWeight, totalEffectiveWeight).toFixed(2);

			const undrawnSets = lottery.prizeSets.filter(s => !s.winnerId);
			const drawnSets = lottery.prizeSets.filter(s => Boolean(s.winnerId));
			const generalPoolBank = new Bank(lottery.generalPool);

			const sections: string[] = [
				`**${lottery.name}**`,
				`Ticket Item: **${ticketItem.name}**`,
				`Total Tickets in Raffle: **${totalTickets.toLocaleString()}**`,
				`Your Tickets: **${userTickets.toLocaleString()}** (Win Chance: **${effectiveChance}%**${userPriorWins > 0 ? `, ${userPriorWins} prior win(s)` : ''})`
			];

			if (undrawnSets.length > 0) {
				sections.push('');
				sections.push('**Prize Sets**');
				for (const s of undrawnSets.slice(0, 15)) {
					sections.push(`- **${s.name}**: ${new Bank(s.items).toString()}`);
				}
				if (undrawnSets.length > 15) {
					sections.push(`- ...and ${undrawnSets.length - 15} more prize set(s).`);
				}
			}

			if (generalPoolBank.length > 0) {
				sections.push('');
				sections.push(`**General Prize Pool** (${lottery.generalPoolSpins} draw(s) remaining)`);
				sections.push(generalPoolBank.toString());
			}

			if (drawnSets.length > 0) {
				sections.push('');
				sections.push('**Completed Draws**');
				for (const s of drawnSets.slice(0, 10)) {
					const winnerDisplay = s.winnerId ? userMention(s.winnerId) : 'Unknown';
					sections.push(`- **${s.name}**: Won by ${winnerDisplay}`);
				}
			}

			if (lottery.gpPricePerTicket || lottery.tradeInRules.length > 0 || lottery.acceptsValueDeposit) {
				sections.push('');
				sections.push('**Get Tickets**');
				if (lottery.gpPricePerTicket) {
					sections.push(
						`- **Buy with GP**: ${lottery.gpPricePerTicket.toLocaleString()} GP per ticket (\`/lottery buy_tickets\`)`
					);
				}
				if (lottery.acceptsValueDeposit) {
					sections.push(
						`- **Deposit Items**: ${lottery.valueDepositThreshold.toLocaleString()} value per ticket at ${lottery.itemValueMultiplier}x item value (\`/lottery deposit_items\`)`
					);
				}
				for (const r of lottery.tradeInRules.slice(0, 10)) {
					sections.push(`- ${formatTradeInRuleLabel(r, lottery.ticketItemId, true)}`);
				}
			}

			const combinedUndrawnLoot = getCombinedLotteryPrizeBank(lottery, false);

			return {
				content: sections.join('\n'),
				files: [await makeBankImage({ bank: combinedUndrawnLoot, title: `${lottery.name} Prize Bank` })],
				allowedMentions: { users: [] }
			};
		}

		if (!lottery.allowIronmen && user.isIronman) {
			return `Ironmen cannot partake in the **${lottery.name}**.`;
		}

		if (options.trade_in) {
			const ruleQuery = options.trade_in.rule;
			const multiplier = options.trade_in.quantity ?? 1;
			if (!Number.isSafeInteger(multiplier) || multiplier < 1 || multiplier > 100_000) {
				return 'Invalid trade-in quantity.';
			}

			const rule = findMatchingTradeInRule(lottery, ruleQuery);
			if (!rule) {
				return `No matching trade-in option found for **${lottery.name}**. Run \`/lottery info\` to view available trade-ins.`;
			}

			const totalCost = new Bank(rule.cost).multiply(multiplier);
			const totalTicketsToGive = rule.ticketsAwarded * multiplier;
			if (!Number.isSafeInteger(totalTicketsToGive) || totalTicketsToGive < 1) {
				return 'Invalid ticket amount calculated.';
			}

			await user.sync();
			if (!user.owns(totalCost)) {
				return `You do not own the required items for this trade-in: **${totalCost}**.`;
			}

			const ticketsBank = new Bank().add(ticketItem.id, totalTicketsToGive);
			const ruleTitle = rule.name && rule.name.trim().length > 0 ? ` (**${rule.name}**)` : '';

			await interaction.confirmation(
				`${user.mention}, are you sure you want to trade **${totalCost}**${ruleTitle} into the **${lottery.name}** for **${ticketsBank}**?`
			);

			await user.sync();
			if (!user.owns(totalCost)) {
				return `You do not own the required items for this trade-in: **${totalCost}**.`;
			}

			await user.transactItems({
				itemsToAdd: ticketsBank,
				itemsToRemove: totalCost,
				collectionLog: false,
				filterLoot: false,
				neverUpdateHistory: true
			});

			if (lottery.tradeInItemsGoIntoPool) {
				await addToLotteryPrizePool(totalCost, lottery.id);
			}

			return `You traded **${totalCost}** and received **${ticketsBank}** for the **${lottery.name}**.`;
		}

		if (options.buy_tickets) {
			if (!lottery.gpPricePerTicket || lottery.gpPricePerTicket < 1) {
				return `The **${lottery.name}** is not currently accepting direct GP purchases for tickets.`;
			}
			const ticketsToBuy = options.buy_tickets.quantity;
			const maxPerDeposit = Math.floor(Number.MAX_SAFE_INTEGER / lottery.gpPricePerTicket);
			if (!Number.isSafeInteger(ticketsToBuy) || ticketsToBuy < 1 || ticketsToBuy > maxPerDeposit) {
				return 'You need to buy a valid number of tickets.';
			}
			const totalPrice = ticketsToBuy * lottery.gpPricePerTicket;
			const bankToSell = new Bank().add('Coins', totalPrice);
			const ticketsBank = new Bank().add(ticketItem.id, ticketsToBuy);

			if (!user.owns(bankToSell)) {
				return `You do not have enough GP (**${bankToSell}**) to buy **${ticketsBank}**.`;
			}

			await interaction.confirmation(
				`${user.mention}, are you sure you want to spend **${bankToSell}** to buy **${ticketsBank}** for the **${lottery.name}**?\n\nItems and GP put into the lottery are non-refundable.`
			);

			await user.sync();
			if (!user.owns(bankToSell)) {
				return "You don't have enough GP to buy these tickets.";
			}

			await user.transactItems({
				itemsToAdd: ticketsBank,
				itemsToRemove: bankToSell,
				collectionLog: false,
				filterLoot: false,
				neverUpdateHistory: true
			});

			if (lottery.gpGoesIntoPool && lottery.gpPoolPercent > 0) {
				const gpForPool = Math.floor((totalPrice * lottery.gpPoolPercent) / 100);
				if (gpForPool > 0) {
					await addToLotteryPrizePool(new Bank().add('Coins', gpForPool), lottery.id);
				}
			}

			return `You spent **${bankToSell}** and received **${ticketsBank}** for the **${lottery.name}**.`;
		}

		if (options.deposit_items) {
			if (!lottery.acceptsValueDeposit) {
				return `The **${lottery.name}** is not currently accepting value-based item deposits. Check \`/lottery info\` for available trade-ins.`;
			}

			let bankToSell = parseBank({
				inputStr: options.deposit_items.items,
				inputBank: user.bankWithGP,
				excludeItems: [...user.user.favoriteItems],
				maxSize: 50,
				search: options.deposit_items.search,
				filters: [options.deposit_items.filter],
				user
			});
			bankToSell = removeIneligibleLotteryItems(bankToSell, lottery.ticketItemId);

			if (bankToSell.length === 0) return 'No eligible items were given.';
			bankToSell = removeIneligibleLotteryItems(
				await LOTTERY_ITEM_BANK_TRANSFORMER({
					user,
					itemBank: bankToSell
				}),
				lottery.ticketItemId
			);
			validatePositiveLotteryBank(bankToSell, 'lottery item deposit');
			if (bankToSell.length === 0) return 'No eligible items were given.';
			if (!user.owns(bankToSell)) return 'You do not own these items.';

			const totalPrice = calcLotteryBankValue(bankToSell, lottery);
			const threshold = lottery.valueDepositThreshold || DEFAULT_LOTTERY_TICKET_PRICE;
			const ticketsFromItems = Math.floor(totalPrice / threshold);

			if (!Number.isSafeInteger(ticketsFromItems) || ticketsFromItems > MAX_LOTTERY_TICKETS_PER_DEPOSIT) {
				return 'Those items are worth too much to process in one lottery deposit.';
			}

			if (ticketsFromItems < 1) {
				return `Those items aren't worth enough; your deposit needs at least ${threshold.toLocaleString()} value to grant 1x ${ticketItem.name}.`;
			}

			const perItemTickets = [];
			for (const [item, quantity] of bankToSell
				.items()
				.sort((a, b) => getPriceOfItem(b[0], lottery) * b[1] - getPriceOfItem(a[0], lottery) * a[1])
				.slice(0, 10)) {
				perItemTickets.push(
					`${((quantity * getPriceOfItem(item, lottery)) / threshold).toFixed(1)} tickets for ${quantity} ${item.name}`
				);
			}

			const ticketsBank = new Bank().add(ticketItem.id, ticketsFromItems);

			await interaction.confirmation(
				`${user.mention}, are you sure you want to deposit **${bankToSell}** into the **${lottery.name}** for **${ticketsBank}**? (${perItemTickets.join(', ')})\n\nItems put into the lottery are non-refundable.`
			);

			await user.sync();
			if (!user.owns(bankToSell)) return 'You do not own these items.';

			await user.transactItems({
				itemsToAdd: ticketsBank,
				itemsToRemove: bankToSell,
				collectionLog: false,
				filterLoot: false,
				neverUpdateHistory: true
			});

			if (lottery.tradeInItemsGoIntoPool) {
				await addToLotteryPrizePool(bankToSell, lottery.id);
			}

			return `You deposited **${bankToSell}** into the **${lottery.name}** and received **${ticketsBank}**.`;
		}

		return 'Invalid lottery option.';
	}
});

export const lotteryAdminSubcommandGroup = {
	type: 'SubcommandGroup',
	name: 'lottery',
	description: 'Admin commands to configure lotteries, prize sets, trade-in rules, and draw winners.',
	options: [
		{
			type: 'Subcommand',
			name: 'configure',
			description: 'Create or update a lottery configuration and tie it to a ticket item.',
			options: [
				{
					type: 'String',
					name: 'id',
					description: 'Lottery ID or name (e.g. rotten_raffle, bank_lottery).',
					required: true,
					autocomplete: adminLotteryAutocomplete
				},
				{
					type: 'String',
					name: 'ticket_item',
					description: 'The ticket item tied to this lottery (e.g. Rotten Raffle ticket).',
					required: false,
					autocomplete: async ({ value, user }: StringAutoComplete) => {
						if (!isLotteryAdmin(user)) return [];
						const q = value.toLowerCase();
						return itemArr
							.filter(i => i.key.includes(q))
							.slice(0, 25)
							.map(i => ({ name: i.name, value: String(i.id) }));
					}
				},
				{
					type: 'String',
					name: 'name',
					description: 'Display name of the lottery.',
					required: false
				},
				{
					type: 'Boolean',
					name: 'active',
					description: 'Whether this lottery is active.',
					required: false
				},
				{
					type: 'Boolean',
					name: 'allow_ironmen',
					description: 'Whether ironmen are eligible in this lottery.',
					required: false
				},
				{
					type: 'Number',
					name: 'decay_factor',
					description: 'Repeat win weight multiplier (0 to 1, e.g. 0.25 reduces weight to 25% per win).',
					required: false,
					min_value: 0,
					max_value: 1
				},
				{
					type: 'Integer',
					name: 'max_wins',
					description: 'Max prize sets a single user can win (0 for unlimited with decay).',
					required: false,
					min_value: 0,
					max_value: 100
				},
				{
					type: 'Integer',
					name: 'gp_price',
					description: 'GP cost per ticket for buy_tickets (0 to disable GP purchases).',
					required: false,
					min_value: 0
				},
				{
					type: 'Boolean',
					name: 'accepts_value_deposit',
					description: 'Whether players can deposit items by value via /lottery deposit_items.',
					required: false
				},
				{
					type: 'Boolean',
					name: 'trade_ins_to_pool',
					description: 'Whether traded-in items are added to the general prize pool instead of sunk.',
					required: false
				},
				{
					type: 'Boolean',
					name: 'make_default',
					description: 'Set this lottery as the default when players omit the lottery option.',
					required: false
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'add_set',
			description: 'Add one or more discrete item sets to a lottery prize bank.',
			options: [
				{
					type: 'String',
					name: 'items',
					description: 'Bank string of items in this set (e.g. 1 Evil partyhat, 5 Pumpkin-ish box).',
					required: true
				},
				{
					type: 'String',
					name: 'name',
					description: 'Display name for this prize set (e.g. Grand Prize Set).',
					required: false
				},
				{
					type: 'Integer',
					name: 'copies',
					description: 'How many copies of this set to add (default: 1).',
					required: false,
					min_value: 1,
					max_value: 50
				},
				{
					type: 'String',
					name: 'lottery',
					description: 'Target lottery (defaults to active/default lottery).',
					required: false,
					autocomplete: adminLotteryAutocomplete
				},
				{
					type: 'Boolean',
					name: 'take_from_bank',
					description: 'If true, remove the items from your own bank instead of spawning them.',
					required: false
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'remove_set',
			description: 'Remove a prize set or clear undrawn prize sets from a lottery.',
			options: [
				{
					type: 'String',
					name: 'set_id',
					description: 'The prize set to remove (or all_undrawn / all).',
					required: true,
					autocomplete: prizeSetAutocomplete
				},
				{
					type: 'String',
					name: 'lottery',
					description: 'Target lottery (defaults to active/default lottery).',
					required: false,
					autocomplete: adminLotteryAutocomplete
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'add_pool',
			description: 'Add items to the general prize pool of a lottery.',
			options: [
				{
					type: 'String',
					name: 'items',
					description: 'Bank string of items to add to the general prize pool.',
					required: true
				},
				{
					type: 'Integer',
					name: 'spins',
					description: 'Total number of share draws configured for the general pool (default: 4).',
					required: false,
					min_value: 1,
					max_value: 50
				},
				{
					type: 'String',
					name: 'lottery',
					description: 'Target lottery (defaults to active/default lottery).',
					required: false,
					autocomplete: adminLotteryAutocomplete
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'add_trade_in',
			description: 'Add a rule allowing players to trade specific items or GP in for tickets.',
			options: [
				{
					type: 'String',
					name: 'cost_items',
					description: 'Bank string of items required (e.g. 1 Pumpkin-ish box, or 10 Pumpkin-ish seeds).',
					required: true
				},
				{
					type: 'Integer',
					name: 'tickets_awarded',
					description: 'Number of tickets awarded per trade-in.',
					required: true,
					min_value: 1,
					max_value: 1_000_000
				},
				{
					type: 'String',
					name: 'name',
					description: 'Optional display name for this trade-in rule (e.g. Pumpkin Box Exchange).',
					required: false
				},
				{
					type: 'String',
					name: 'lottery',
					description: 'Target lottery (defaults to active/default lottery).',
					required: false,
					autocomplete: adminLotteryAutocomplete
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'remove_trade_in',
			description: 'Remove a trade-in rule from a lottery.',
			options: [
				{
					type: 'String',
					name: 'rule_id',
					description: 'The trade-in rule to remove (or all).',
					required: true,
					autocomplete: async (opts: StringAutoComplete) => {
						if (!isLotteryAdmin(opts.user)) return [];
						const list = await tradeInRuleAutocomplete(opts);
						return [{ name: 'All Trade-In Rules', value: 'all' }, ...list].slice(0, 25);
					}
				},
				{
					type: 'String',
					name: 'lottery',
					description: 'Target lottery (defaults to active/default lottery).',
					required: false,
					autocomplete: adminLotteryAutocomplete
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'draw',
			description: 'Draw winner(s) for prize sets or the general pool with an animated roll.',
			options: [
				{
					type: 'String',
					name: 'target',
					description: 'What to draw: next_set, all_sets, general_pool, or a specific prize set.',
					required: false,
					autocomplete: drawTargetAutocomplete
				},
				{
					type: 'Integer',
					name: 'draws',
					description: 'Number of draws to perform right now (default: 1).',
					required: false,
					min_value: 1,
					max_value: 50
				},
				{
					type: 'Number',
					name: 'pool_percent',
					description:
						'For general_pool: percent of remaining pool to award per draw (1-100, overrides share count).',
					required: false,
					min_value: 1,
					max_value: 100
				},
				{
					type: 'String',
					name: 'pool_items',
					description: 'For general_pool: exact bank string of items to pull from the general pool per draw.',
					required: false
				},
				{
					type: 'String',
					name: 'lottery',
					description: 'Target lottery (defaults to active/default lottery).',
					required: false,
					autocomplete: adminLotteryAutocomplete
				},
				{
					type: 'Boolean',
					name: 'instant',
					description: 'Skip the animated hype roll delay and reveal winners immediately.',
					required: false
				}
			]
		},
		{
			type: 'Subcommand',
			name: 'reset',
			description: 'Reset draw history/win counts, clear prizes, or wipe tickets from all user banks.',
			options: [
				{
					type: 'String',
					name: 'action',
					description: 'Reset action to perform.',
					required: true,
					choices: choicesOf(['reset_draws', 'clear_prizes', 'wipe_user_tickets'] as const)
				},
				{
					type: 'String',
					name: 'lottery',
					description: 'Target lottery (defaults to active/default lottery).',
					required: false,
					autocomplete: adminLotteryAutocomplete
				}
			]
		}
	]
} as const satisfies CommandOption;

export type LotteryAdminOptions = ExtractOptions<typeof lotteryAdminSubcommandGroup.options>;

export async function handleLotteryAdminCommand({
	user,
	options,
	interaction,
	channelId
}: {
	user: MUser;
	options: LotteryAdminOptions;
	interaction: OSInteraction;
	channelId: string;
}): CommandResponse {
	if (!isLotteryAdmin(user)) {
		return 'You do not have permission to manage lotteries.';
	}

	if (options.configure) {
		const cfgOpts = options.configure;
		const id = normalizeLotteryId(cfgOpts.id);
		if (!id) return 'Invalid lottery ID.';

		return withLotteryLock(async () => {
			const state = getLotteriesState();
			const existing = state.lotteries[id];

			let resolvedTicketItem: Item | null = null;
			if (cfgOpts.ticket_item) {
				resolvedTicketItem = Items.getItem(cfgOpts.ticket_item);
				if (!resolvedTicketItem) {
					return `Invalid ticket item: ${cfgOpts.ticket_item}`;
				}
			} else if (existing) {
				resolvedTicketItem = Items.getItem(existing.ticketItemId);
			} else {
				resolvedTicketItem = ROTTEN_RAFFLE_TICKET_ITEM;
			}

			const updated: LotteryConfig = normalizeLotteryConfig({
				...(existing ?? {
					id,
					name: cfgOpts.name ?? id,
					ticketItemId: resolvedTicketItem!.id,
					active: true,
					allowIronmen: true,
					repeatWinDecayFactor: 0.25
				}),
				id,
				name: cfgOpts.name ?? existing?.name ?? id,
				ticketItemId: resolvedTicketItem!.id,
				active: cfgOpts.active !== undefined ? cfgOpts.active : (existing?.active ?? true),
				allowIronmen:
					cfgOpts.allow_ironmen !== undefined ? cfgOpts.allow_ironmen : (existing?.allowIronmen ?? true),
				repeatWinDecayFactor:
					cfgOpts.decay_factor !== undefined
						? cfgOpts.decay_factor
						: (existing?.repeatWinDecayFactor ?? 0.25),
				maxWinsPerUser:
					cfgOpts.max_wins !== undefined
						? cfgOpts.max_wins === 0
							? null
							: cfgOpts.max_wins
						: (existing?.maxWinsPerUser ?? null),
				gpPricePerTicket:
					cfgOpts.gp_price !== undefined
						? cfgOpts.gp_price === 0
							? null
							: cfgOpts.gp_price
						: (existing?.gpPricePerTicket ?? null),
				acceptsValueDeposit:
					cfgOpts.accepts_value_deposit !== undefined
						? cfgOpts.accepts_value_deposit
						: (existing?.acceptsValueDeposit ?? false),
				tradeInItemsGoIntoPool:
					cfgOpts.trade_ins_to_pool !== undefined
						? cfgOpts.trade_ins_to_pool
						: (existing?.tradeInItemsGoIntoPool ?? false)
			});

			state.lotteries[id] = updated;
			if (cfgOpts.make_default) {
				state.defaultLotteryId = id;
			}
			saveLotteriesState(state);

			return `Updated lottery settings:\n\n${formatAdminLotterySummary(updated)}`;
		});
	}

	if (options.add_set) {
		const addOpts = options.add_set;
		const setBank = parseBank({ inputStr: addOpts.items, noDuplicateItems: true });
		if (setBank.length === 0) return 'No valid items were provided for the prize set.';
		validatePositiveLotteryBank(setBank, 'prize set items');
		const copies = addOpts.copies ?? 1;

		if (addOpts.take_from_bank) {
			const totalRequired = setBank.clone().multiply(copies);
			await user.sync();
			if (!user.bankWithGP.has(totalRequired)) {
				return `You do not own enough items to fund ${copies}x of this set (${totalRequired}).`;
			}
			await user.removeItemsFromBank(totalRequired);
		}

		return withLotteryLock(async () => {
			const state = getLotteriesState();
			const lottery = resolveLotteryFromState(state, addOpts.lottery);
			const addedNames: string[] = [];

			for (let c = 0; c < copies; c++) {
				const nextNum = lottery.prizeSets.length + 1;
				const setId = `set_${Date.now()}_${nextNum}`;
				const setName = addOpts.name
					? copies > 1
						? `${addOpts.name} #${c + 1}`
						: addOpts.name
					: `Prize Set #${nextNum}`;

				lottery.prizeSets.push({
					id: setId,
					name: setName,
					items: setBank.toJSON(),
					winnerId: null,
					winnerUsername: null,
					drawnAt: null
				});
				addedNames.push(`**${setName}**`);
			}

			state.lotteries[lottery.id] = lottery;
			saveLotteriesState(state);

			const combinedLoot = getCombinedLotteryPrizeBank(lottery, false);
			return {
				content: `Added ${copies > 1 ? `${copies} prize sets` : 'prize set'} (${setBank}) to **${lottery.name}**:\n${addedNames.join(', ')}`,
				files: [await makeBankImage({ bank: combinedLoot, title: `${lottery.name} Prize Bank` })]
			};
		});
	}

	if (options.remove_set) {
		const remOpts = options.remove_set;
		return withLotteryLock(async () => {
			const state = getLotteriesState();
			const lottery = resolveLotteryFromState(state, remOpts.lottery);
			const beforeCount = lottery.prizeSets.length;

			if (remOpts.set_id === 'all') {
				lottery.prizeSets = [];
			} else if (remOpts.set_id === 'all_undrawn') {
				lottery.prizeSets = lottery.prizeSets.filter(s => Boolean(s.winnerId));
			} else {
				lottery.prizeSets = lottery.prizeSets.filter(
					s => s.id !== remOpts.set_id && s.name.toLowerCase() !== remOpts.set_id.toLowerCase()
				);
			}

			const removedCount = beforeCount - lottery.prizeSets.length;
			if (removedCount === 0) {
				return `No matching prize set found in **${lottery.name}**.`;
			}

			state.lotteries[lottery.id] = lottery;
			saveLotteriesState(state);
			const remainingUndrawn = lottery.prizeSets.filter(s => !s.winnerId).length;
			return `Removed ${removedCount} prize set(s) from **${lottery.name}**. Undrawn sets remaining: **${remainingUndrawn}**.`;
		});
	}

	if (options.add_pool) {
		const poolOpts = options.add_pool;
		const itemsToAdd = parseBank({ inputStr: poolOpts.items, noDuplicateItems: true });
		if (itemsToAdd.length === 0) return 'No valid items were provided for the general pool.';
		validatePositiveLotteryBank(itemsToAdd, 'general pool items');

		return withLotteryLock(async () => {
			const state = getLotteriesState();
			const lottery = resolveLotteryFromState(state, poolOpts.lottery);
			const updatedPool = new Bank(lottery.generalPool).add(itemsToAdd);
			lottery.generalPool = updatedPool.toJSON();
			if (poolOpts.spins) {
				lottery.generalPoolSpins = poolOpts.spins;
			}
			state.lotteries[lottery.id] = lottery;
			saveLotteriesState(state);

			return {
				content: `Added **${itemsToAdd}** to the **${lottery.name}** general prize pool.\n**Total General Pool:** ${updatedPool}\n**Configured Draw Shares:** ${lottery.generalPoolSpins}`,
				files: [await makeBankImage({ bank: updatedPool, title: `${lottery.name} General Pool` })]
			};
		});
	}

	if (options.add_trade_in) {
		const tradeOpts = options.add_trade_in;
		const costBank = parseBank({ inputStr: tradeOpts.cost_items, noDuplicateItems: true });
		if (costBank.length === 0) return 'No valid cost items were provided for the trade-in rule.';
		validatePositiveLotteryBank(costBank, 'trade-in cost items');

		return withLotteryLock(async () => {
			const state = getLotteriesState();
			const lottery = resolveLotteryFromState(state, tradeOpts.lottery);
			const ruleId = `rule_${Date.now()}_${lottery.tradeInRules.length + 1}`;
			const newRule: LotteryTradeInRule = {
				id: ruleId,
				name: tradeOpts.name?.trim() || null,
				cost: costBank.toJSON(),
				ticketsAwarded: tradeOpts.tickets_awarded
			};
			lottery.tradeInRules.push(newRule);
			state.lotteries[lottery.id] = lottery;
			saveLotteriesState(state);

			return `Added trade-in rule to **${lottery.name}**:\n- ${formatTradeInRuleLabel(newRule, lottery.ticketItemId, true)}`;
		});
	}

	if (options.remove_trade_in) {
		const remRuleOpts = options.remove_trade_in;
		return withLotteryLock(async () => {
			const state = getLotteriesState();
			const lottery = resolveLotteryFromState(state, remRuleOpts.lottery);
			const before = lottery.tradeInRules.length;

			if (remRuleOpts.rule_id === 'all') {
				lottery.tradeInRules = [];
			} else {
				const matched = findMatchingTradeInRule(lottery, remRuleOpts.rule_id);
				if (matched) {
					lottery.tradeInRules = lottery.tradeInRules.filter(r => r.id !== matched.id);
				}
			}

			const removed = before - lottery.tradeInRules.length;
			if (removed === 0) {
				return `No matching trade-in rule found in **${lottery.name}**.`;
			}
			state.lotteries[lottery.id] = lottery;
			saveLotteriesState(state);
			return `Removed ${removed} trade-in rule(s) from **${lottery.name}**. Remaining rules: **${lottery.tradeInRules.length}**.`;
		});
	}

	if (options.draw) {
		const drawOpts = options.draw;
		const target = drawOpts.target ?? 'next_set';
		const instant = Boolean(drawOpts.instant);
		const requestedDraws = drawOpts.draws ?? 1;

		if (!interaction.deferred && !interaction.replied) {
			await interaction.defer();
		}

		return withLotteryLock(async () => {
			const state = getLotteriesState();
			const lottery = resolveLotteryFromState(state, drawOpts.lottery);
			const ticketItem = Items.getOrThrow(lottery.ticketItemId);

			if (target === 'general_pool') {
				const poolBank = new Bank(lottery.generalPool);
				if (poolBank.length === 0) {
					return `The general prize pool for **${lottery.name}** is currently empty.`;
				}

				const workingPool = poolBank.clone();
				let explicitShareBank: Bank | null = null;
				if (drawOpts.pool_items) {
					explicitShareBank = parseBank({ inputStr: drawOpts.pool_items, noDuplicateItems: true });
					if (explicitShareBank.length === 0) {
						return 'No valid items were parsed from `pool_items`.';
					}
					const totalNeeded = explicitShareBank.clone().multiply(requestedDraws);
					if (!workingPool.has(totalNeeded)) {
						return `The general pool does not have enough items for ${requestedDraws}x of (${explicitShareBank}). Current pool: ${workingPool}`;
					}
				}

				const totalConfiguredShares = Math.max(1, lottery.generalPoolSpins);
				const drawsToRun = explicitShareBank
					? requestedDraws
					: drawOpts.pool_percent
						? requestedDraws
						: Math.min(requestedDraws, totalConfiguredShares);

				const summaries: string[] = [];

				for (let drawIdx = 0; drawIdx < drawsToRun; drawIdx++) {
					const holders = await fetchLotteryTicketHolders(lottery);
					const winner = pickWeightedTicketHolder(holders);
					if (!winner) {
						return `No eligible ticket holders with positive weight found for **${lottery.name}**.`;
					}

					const shareBank = new Bank();

					if (explicitShareBank) {
						shareBank.add(explicitShareBank);
						workingPool.remove(explicitShareBank);
					} else if (drawOpts.pool_percent) {
						const pct = Math.max(1, Math.min(100, drawOpts.pool_percent));
						for (const [item, qty] of workingPool.items()) {
							const shareQty = pct === 100 ? qty : Math.max(1, Math.floor((qty * pct) / 100));
							if (shareQty > 0) {
								shareBank.add(item.id, shareQty);
								workingPool.remove(item.id, shareQty);
							}
						}
					} else {
						const currentSharesLeft = Math.max(1, lottery.generalPoolSpins);
						for (const [item, qty] of workingPool.items()) {
							const shareQty =
								currentSharesLeft <= 1 ? qty : Math.max(1, Math.floor(qty / currentSharesLeft));
							if (shareQty > 0) {
								shareBank.add(item.id, shareQty);
								workingPool.remove(item.id, shareQty);
							}
						}
						if (lottery.generalPoolSpins > 1) {
							lottery.generalPoolSpins -= 1;
						}
					}

					if (shareBank.length === 0) break;

					const spinNumber = lottery.generalPoolWinners.length + 1;
					const spinTitle = `General Pool Draw #${spinNumber}`;

					await executeAnimatedDraw({
						channelId,
						interaction,
						lottery,
						prizeTitle: spinTitle,
						prizeBank: shareBank,
						holders,
						winner,
						instant
					});

					const winnerUser = await mUserFetch(winner.id);
					await winnerUser.addItemsToBank({ items: shareBank, collectionLog: false });
					if (lottery.consumeWinningTicket && winnerUser.bank.amount(ticketItem.id) > 0) {
						await winnerUser.removeItemsFromBank(new Bank().add(ticketItem.id, 1));
					}

					lottery.winCounts[winner.id] = (lottery.winCounts[winner.id] ?? 0) + 1;
					lottery.generalPoolWinners.push({
						spinIndex: spinNumber,
						winnerId: winner.id,
						winnerUsername: winner.username,
						items: shareBank.toJSON(),
						drawnAt: Date.now()
					});
					summaries.push(`- **${spinTitle}**: ${formatCandidateMention(winner)} won **${shareBank}**`);

					lottery.generalPool = workingPool.toJSON();
					state.lotteries[lottery.id] = lottery;
					saveLotteriesState(state);

					if (drawIdx < drawsToRun - 1 && !instant && !process.env.TEST) {
						await sleep(1500);
					}
				}

				return {
					content: [
						`Completed **${lottery.name}** General Pool draw (${summaries.length} draw(s)):`,
						...summaries,
						`Remaining General Pool: **${workingPool.length > 0 ? workingPool.toString() : 'Empty'}**`
					].join('\n'),
					allowedMentions: { users: [] }
				};
			}

			const undrawnSets = lottery.prizeSets.filter(s => !s.winnerId);
			const setsToDraw =
				target === 'all_sets'
					? undrawnSets
					: target === 'next_set'
						? undrawnSets.slice(0, requestedDraws)
						: undrawnSets.filter(s => s.id === target || s.name.toLowerCase() === target.toLowerCase());

			if (setsToDraw.length === 0) {
				return `No undrawn prize sets remaining to draw in **${lottery.name}**.`;
			}

			const drawSummaries: string[] = [];

			for (let idx = 0; idx < setsToDraw.length; idx++) {
				const set = setsToDraw[idx]!;
				const holders = await fetchLotteryTicketHolders(lottery);
				const winner = pickWeightedTicketHolder(holders);
				if (!winner) {
					return `No eligible ticket holders with positive weight found for **${lottery.name}**.`;
				}

				const setBank = new Bank(set.items);
				await executeAnimatedDraw({
					channelId,
					interaction,
					lottery,
					prizeTitle: set.name,
					prizeBank: setBank,
					holders,
					winner,
					instant
				});

				const winnerUser = await mUserFetch(winner.id);
				await winnerUser.addItemsToBank({ items: setBank, collectionLog: false });
				if (lottery.consumeWinningTicket && winnerUser.bank.amount(ticketItem.id) > 0) {
					await winnerUser.removeItemsFromBank(new Bank().add(ticketItem.id, 1));
				}

				set.winnerId = winner.id;
				set.winnerUsername = winner.username;
				set.drawnAt = Date.now();
				lottery.winCounts[winner.id] = (lottery.winCounts[winner.id] ?? 0) + 1;

				drawSummaries.push(
					`- **${set.name}**: Won by ${formatCandidateMention(winner)} (${winner.tickets.toLocaleString()} tickets): **${setBank}**`
				);

				state.lotteries[lottery.id] = lottery;
				saveLotteriesState(state);

				if (idx < setsToDraw.length - 1 && !instant && !process.env.TEST) {
					await sleep(1800);
				}
			}

			return {
				content: `Completed **${lottery.name}** prize set draw (${drawSummaries.length} set(s) drawn):\n${drawSummaries.join('\n')}`,
				allowedMentions: { users: [] }
			};
		});
	}

	if (options.reset) {
		const resetOpts = options.reset;
		return withLotteryLock(async () => {
			const state = getLotteriesState();
			const lottery = resolveLotteryFromState(state, resetOpts.lottery);
			const ticketItem = Items.getOrThrow(lottery.ticketItemId);

			if (resetOpts.action === 'reset_draws') {
				lottery.winCounts = {};
				lottery.generalPoolWinners = [];
				for (const set of lottery.prizeSets) {
					set.winnerId = null;
					set.winnerUsername = null;
					set.drawnAt = null;
				}
				state.lotteries[lottery.id] = lottery;
				saveLotteriesState(state);
				return `Reset all drawn statuses and repeat-winner counts for **${lottery.name}**. All **${lottery.prizeSets.length}** prize sets are ready to be drawn again.`;
			}

			if (resetOpts.action === 'clear_prizes') {
				lottery.prizeSets = [];
				lottery.generalPool = {};
				lottery.generalPoolWinners = [];
				lottery.winCounts = {};
				state.lotteries[lottery.id] = lottery;
				saveLotteriesState(state);
				return `Cleared all prize sets, general pool items, and draw history for **${lottery.name}**.`;
			}

			if (resetOpts.action === 'wipe_user_tickets') {
				const holders = await fetchLotteryTicketHolders({
					...lottery,
					allowIronmen: true
				});
				const csvRows = [
					'user_id,username,tickets_removed',
					...holders.map(h => `${h.id},${h.username.replace(/,/g, '_')},${h.tickets}`)
				].join('\n');

				let removedUsers = 0;
				let removedTickets = 0;

				for (const holder of holders) {
					const targetUser = await mUserFetch(holder.id);
					const qty = targetUser.bank.amount(ticketItem.id);
					if (qty < 1) continue;
					await targetUser.transactItems({
						itemsToRemove: new Bank().add(ticketItem.id, qty),
						filterLoot: false,
						neverUpdateHistory: true
					});
					removedUsers++;
					removedTickets += qty;
				}

				return {
					content: `Wiped **${removedTickets.toLocaleString()}x ${ticketItem.name}** from **${removedUsers.toLocaleString()}** player bank(s) for **${lottery.name}**.`,
					files: [
						{
							name: `${lottery.id}-ticket-wipe-${Date.now()}.csv`,
							buffer: Buffer.from(csvRows, 'utf-8')
						}
					]
				};
			}

			return 'Invalid reset action.';
		});
	}

	return 'Invalid lottery admin option.';
}

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { increaseNumByPercent, reduceNumByPercent } from '@oldschoolgg/toolkit';
import { Items, toKMB } from 'oldschooljs';

type LatestPriceEntry = {
	high: number | null;
	highTime: number | null;
	low: number | null;
	lowTime: number | null;
};

type Avg24hPriceEntry = {
	avgHighPrice: number | null;
	highPriceVolume: number;
	avgLowPrice: number | null;
	lowPriceVolume: number;
};

type CachedPayload = {
	fetchedAt: number;
	latest: Record<string, LatestPriceEntry>;
	avg24h: Record<string, Avg24hPriceEntry>;
};

const ITEM_DATA_PATH = path.resolve('packages/oldschooljs/src/assets/item_data.json');
const CACHE_DIR = path.resolve('tmp');
const CACHE_FILE = path.join(CACHE_DIR, 'osrs_wiki_prices_cache.json');
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const USER_AGENT = 'A-BSO Manual Price Sync Script - Contact: OldSchoolBot/A-BSO Maintainers';

const IGNORED_ITEM_NAMES = [
	'Raw bird meat',
	'Red feather',
	'Yellow feather',
	'Orange feather',
	'Blue feather',
	'Stripy feather',
	'Ferret',
	'Ruby harvest',
	'Sapphire glacialis',
	'Snowy knight',
	'Black warlock',
	'Kebbit claws',
	'Barb-tail harpoon',
	'Kebbit spike',
	'Kebbit teeth',
	'Damaged monkey tail',
	'Monkey tail',
	'Spotted kebbit fur',
	'Dark kebbit fur',
	'Dashing kebbit fur',
	'Imp-in-a-box(2)',
	'Swamp lizard',
	'Orange salamander',
	'Red salamander',
	'Black salamander',
	'Larupia fur',
	'Tatty larupia fur',
	'Graahk fur',
	'Tatty graahk fur',
	'Kyatt fur',
	'Tatty kyatt fur',
	'Raw rabbit',
	'Rabbit foot',
	'Polar kebbit fur',
	'Raw beast meat',
	'Common kebbit fur',
	'Feldip weasel fur',
	'Desert devil fur',
	'Long kebbit spike',
	'Fish food',
	'Iron bolts (p+)',
	'Cream boots',
	'Brandy',
	'Premade sgg',
	'Spicy crunchies',
	'Premade veg batta',
	'Assorted flowers',
	'Purple hat',
	"Blood'n'tar snelm",
	'Fremennik brown cloak',
	'Fremennik brown shirt',
	'Shirt',
	'Steel arrow(p++)',
	'Spider on shaft',
	'Tribal mask',
	'White dagger',
	'Sandstone (5kg)',
	'Minced meat',
	'Bagged dead tree',
	'Kitchen table',
	'Teak bed',
	'Bandana eyepatch',
	'Elemental helmet',
	'Butterfly net',
	'Light orb',
	'Steel hasta',
	'Defence mix(2)',
	'Arceuus banner',
	'Yellow cape',
	'Iron spear(p+)',
	'Egg and tomato',
	"Druid's robe top",
	'Bronze thrownaxe',
	'Steel thrownaxe',
	'Iron javelin(p)',
	'Black longsword',
	"Premade s'y crunch",
	'Redberry pie',
	'Serum 207 (2)',
	'Fremennik red shirt',
	'Dwellberry seed',
	'Iron javelin(p++)',
	'Steel knife(p+)',
	'Mithril dagger(p++)',
	'Thatch spar dense',
	'Villager armband',
	'Sliced mushrooms',
	'Raw fish pie',
	"Blue d'hide chaps (g)",
	'Oak armchair',
	'Teak armchair',
	'Beer barrel',
	'Carved oak bench',
	'Carved teak bench',
	'Oak stock',
	'Oak toy box',
	'Teak magic wardrobe',
	'Oak armour case',
	'Roast beast meat',
	"Relicym's mix(2)",
	'Antidote+ mix(1)'
];

const PINNED_SHOP_PRICES: Record<number, number> = {
	233: 128,
	1013: 63,
	1353: 149,
	7433: 537
};

const ignoredItemIds = new Set<number>(
	IGNORED_ITEM_NAMES.map(name => Items.getItem(name)?.id).filter((id): id is number => typeof id === 'number')
);

async function loadWikiPrices(forceRefresh = false): Promise<CachedPayload> {
	if (!forceRefresh && existsSync(CACHE_FILE)) {
		const cached = JSON.parse(readFileSync(CACHE_FILE, 'utf-8')) as CachedPayload;
		if (Date.now() - cached.fetchedAt < CACHE_TTL_MS && cached.latest && cached.avg24h) {
			console.log('Using local cached OSRS Wiki price data.');
			return cached;
		}
	}

	console.log('Fetching bulk price data from OSRS Wiki API (2 requests total)...');
	const [latestRes, avg24hRes] = await Promise.all([
		fetch('https://prices.runescape.wiki/api/v1/osrs/latest', {
			headers: { 'User-Agent': USER_AGENT }
		}),
		fetch('https://prices.runescape.wiki/api/v1/osrs/24h', {
			headers: { 'User-Agent': USER_AGENT }
		})
	]);

	if (!latestRes.ok || !avg24hRes.ok) {
		throw new Error(`Failed to fetch Wiki prices: latest=${latestRes.status}, 24h=${avg24hRes.status}`);
	}

	const latestJson = (await latestRes.json()) as { data: Record<string, LatestPriceEntry> };
	const avg24hJson = (await avg24hRes.json()) as { data: Record<string, Avg24hPriceEntry> };

	if (!latestJson.data?.['20997']) {
		throw new Error('Wiki price payload validation failed (missing Twisted bow ID 20997).');
	}

	const payload: CachedPayload = {
		fetchedAt: Date.now(),
		latest: latestJson.data,
		avg24h: avg24hJson.data ?? {}
	};

	mkdirSync(CACHE_DIR, { recursive: true });
	writeFileSync(CACHE_FILE, JSON.stringify(payload), 'utf-8');
	return payload;
}

function computeCandidatePrice(
	latest: LatestPriceEntry | undefined,
	avg24h: Avg24hPriceEntry | undefined
): { price: number; high: number; low: number } | null {
	if (avg24h && (avg24h.avgHighPrice !== null || avg24h.avgLowPrice !== null)) {
		const high = avg24h.avgHighPrice ?? avg24h.avgLowPrice!;
		const low = avg24h.avgLowPrice ?? avg24h.avgHighPrice!;
		const adjHigh = high < low ? low : high;
		const price = Math.ceil(Math.max(0, (adjHigh + low) / 2));
		if (price > 0) {
			return { price, high: adjHigh, low };
		}
	}

	if (!latest || (latest.high === null && latest.low === null)) {
		return null;
	}

	const rawHigh = latest.high ?? latest.low!;
	const rawLow = latest.low ?? latest.high!;
	const high = rawHigh < rawLow ? rawLow : rawHigh;
	const low = rawLow;
	const price = Math.ceil(Math.max(0, (high + low) / 2));
	if (price <= 0) return null;
	return { price, high, low };
}

async function main() {
	const forceRefresh = process.argv.includes('--refresh');
	const dryRun = process.argv.includes('--dry-run');
	const { latest, avg24h } = await loadWikiPrices(forceRefresh);

	const rawItems = JSON.parse(readFileSync(ITEM_DATA_PATH, 'utf-8')) as Record<string, Record<string, any>>;

	let updatedCount = 0;
	const overMaxIntItems: Array<{ id: number; name: string; oldPrice: number; newPrice: number }> = [];
	const diffs: Array<{ id: number; name: string; oldPrice: number; newPrice: number; ratio: number; delta: number }> =
		[];

	for (const [idStr, item] of Object.entries(rawItems)) {
		const id = Number(idStr);
		if (!item || typeof item !== 'object') continue;

		if (PINNED_SHOP_PRICES[id] !== undefined) {
			item.price = PINNED_SHOP_PRICES[id];
			continue;
		}

		if (ignoredItemIds.has(id)) {
			delete item.price;
			continue;
		}

		if (id === 995) {
			item.price = 1;
			continue;
		}

		if (!item.tradeable && !item.tradeable_on_ge) {
			continue;
		}

		const candidate = computeCandidatePrice(latest[idStr], avg24h[idStr]);
		if (!candidate) continue;

		const prevPrice = typeof item.price === 'number' ? item.price : 0;
		let nextPrice = candidate.price;

		if (candidate.low > 0 && candidate.high / 10_000 > candidate.low) {
			continue;
		}

		if (prevPrice > 0) {
			const isLowValueManip = prevPrice < 50_000 && nextPrice > prevPrice * 25 && nextPrice < 50_000_000;
			const isBogusCrash = prevPrice > 10_000_000 && candidate.low <= 100_000 && nextPrice < prevPrice / 10;
			if (isLowValueManip || isBogusCrash) {
				continue;
			}

			if (
				prevPrice !== 2_147_483_647 &&
				nextPrice > reduceNumByPercent(prevPrice, 10) &&
				nextPrice < increaseNumByPercent(prevPrice, 10) &&
				nextPrice < 100_000
			) {
				nextPrice = prevPrice;
			} else if (
				prevPrice !== 2_147_483_647 &&
				nextPrice > reduceNumByPercent(prevPrice, 3) &&
				nextPrice < increaseNumByPercent(prevPrice, 3)
			) {
				nextPrice = prevPrice;
			}
		}

		if (nextPrice <= 0) {
			delete item.price;
			continue;
		}

		if (nextPrice > 2_147_483_647) {
			overMaxIntItems.push({ id, name: item.name, oldPrice: prevPrice, newPrice: nextPrice });
		}

		if (nextPrice !== prevPrice) {
			updatedCount++;
			diffs.push({
				id,
				name: item.name,
				oldPrice: prevPrice,
				newPrice: nextPrice,
				ratio: prevPrice > 0 ? nextPrice / prevPrice : nextPrice,
				delta: nextPrice - prevPrice
			});
			item.price = nextPrice;
		}
	}

	console.log(`Total items updated: ${updatedCount}`);
	console.log(`Items over 2.147B GE cap (${overMaxIntItems.length}):`);
	for (const entry of overMaxIntItems.sort((a, b) => b.newPrice - a.newPrice)) {
		console.log(
			`  [${entry.id}] ${entry.name}: ${toKMB(entry.oldPrice)} -> ${toKMB(entry.newPrice)} (${entry.newPrice.toLocaleString()} GP)`
		);
	}

	const topIncreases = [...diffs].sort((a, b) => b.delta - a.delta).slice(0, 30);
	console.log('\nTop 30 largest GP increases:');
	for (const entry of topIncreases) {
		console.log(
			`  [${entry.id}] ${entry.name}: ${toKMB(entry.oldPrice)} -> ${toKMB(entry.newPrice)} (+${toKMB(entry.delta)})`
		);
	}

	const topDecreases = [...diffs].sort((a, b) => a.delta - b.delta).slice(0, 15);
	console.log('\nTop 15 largest GP decreases:');
	for (const entry of topDecreases) {
		console.log(
			`  [${entry.id}] ${entry.name}: ${toKMB(entry.oldPrice)} -> ${toKMB(entry.newPrice)} (${toKMB(entry.delta)})`
		);
	}

	if (!dryRun) {
		writeFileSync(ITEM_DATA_PATH, `${JSON.stringify(rawItems, null, '\t')}\n`, 'utf-8');
		console.log(`\nSuccessfully updated ${ITEM_DATA_PATH}`);
	} else {
		console.log('\nDry run completed (no files written).');
	}
}

main();

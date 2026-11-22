import { stringMatches } from '@oldschoolgg/toolkit';
import { type Bank, Items } from 'oldschooljs';

import { allCollectionLogs } from '@/lib/data/Collections.js';

export function parseDropRateInput(input: string): { probability: number; displayRate: string } | null {
	const cleaned = input.trim().replace(/,/g, '');
	if (!cleaned) return null;

	if (cleaned.includes('/')) {
		const parts = cleaned.split('/').map(p => Number(p.trim()));
		if (parts.length !== 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) return null;
		const [num, den] = parts;
		if (num <= 0 || den <= 0 || num > den) return null;
		return {
			probability: num / den,
			displayRate: `${num}/${den.toLocaleString()}`
		};
	}

	if (cleaned.endsWith('%')) {
		const pct = Number(cleaned.slice(0, -1).trim());
		if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) return null;
		const prob = pct / 100;
		return {
			probability: prob,
			displayRate: `1/${Math.round((1 / prob) * 100) / 100} (${pct}%)`
		};
	}

	const num = Number(cleaned);
	if (!Number.isFinite(num) || num <= 0) return null;

	if (num < 1) {
		return {
			probability: num,
			displayRate: `1/${Math.round((1 / num) * 100) / 100}`
		};
	}

	if (num === 1) {
		return {
			probability: 1,
			displayRate: '1/1'
		};
	}

	return {
		probability: 1 / num,
		displayRate: `1/${num.toLocaleString()}`
	};
}

function logGamma(z: number): number {
	const g = 7;
	const c = [
		0.9999999999998099, 676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406,
		12.507343278686905, -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7
	];
	if (z < 0.5) {
		return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
	}
	let x = c[0];
	const zMinus1 = z - 1;
	for (let i = 1; i < g + 2; i++) {
		x += c[i] / (zMinus1 + i);
	}
	const t = zMinus1 + g + 0.5;
	return 0.5 * Math.log(2 * Math.PI) + (zMinus1 + 0.5) * Math.log(t) - t + Math.log(x);
}

function logBinomialPMF(n: number, k: number, p: number): number {
	if (k < 0 || k > n) return Number.NEGATIVE_INFINITY;
	if (p <= 0) return k === 0 ? 0 : Number.NEGATIVE_INFINITY;
	if (p >= 1) return k === n ? 0 : Number.NEGATIVE_INFINITY;
	const logComb = logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
	return logComb + k * Math.log(p) + (n - k) * Math.log1p(-p);
}

export function calculateDryStreak({
	dropRateInput,
	kills,
	drops = 0
}: {
	dropRateInput: string;
	kills: number;
	drops?: number;
}):
	| { error: string }
	| {
			displayRate: string;
			probability: number;
			kills: number;
			drops: number;
			expectedDrops: number;
			dryMultiple: number;
			probAtMostK: number;
			probMoreThanK: number;
			probExactK: number;
			probAtLeastOne: number;
	  } {
	if (!Number.isInteger(kills) || kills < 1 || kills > 100_000_000) {
		return { error: 'Kills must be a whole number between 1 and 100,000,000.' };
	}
	if (!Number.isInteger(drops) || drops < 0 || drops > kills) {
		return { error: 'Drops must be a whole number between 0 and your kill count.' };
	}
	if (drops > 50_000) {
		return { error: 'Drops count is too large to calculate exact cumulative probability (max 50,000).' };
	}

	const parsed = parseDropRateInput(dropRateInput);
	if (!parsed) {
		return { error: 'Invalid drop rate. Provide a rate such as `1/500`, `500`, or `0.002`.' };
	}

	const { probability: p, displayRate } = parsed;
	const expectedDrops = kills * p;
	const dryMultiple = expectedDrops;
	const probZero = p >= 1 ? 0 : Math.exp(kills * Math.log1p(-p));
	const probAtLeastOne = Math.max(0, Math.min(1, 1 - probZero));
	const probExactK = Math.max(0, Math.min(1, Math.exp(logBinomialPMF(kills, drops, p))));

	let cumulativeAtMostK = 0;
	for (let k = 0; k <= drops; k++) {
		cumulativeAtMostK += Math.exp(logBinomialPMF(kills, k, p));
	}
	const probAtMostK = Math.max(0, Math.min(1, cumulativeAtMostK));
	const probMoreThanK = Math.max(0, Math.min(1, 1 - probAtMostK));

	return {
		displayRate,
		probability: p,
		kills,
		drops,
		expectedDrops,
		dryMultiple,
		probAtMostK,
		probMoreThanK,
		probExactK,
		probAtLeastOne
	};
}

function formatPct(prob: number): string {
	const pct = prob * 100;
	if (pct === 0 || pct === 100) return `${pct.toFixed(2)}%`;
	if (pct < 0.0001) return '<0.0001%';
	if (pct > 99.9999) return '>99.9999%';
	if (pct < 0.01 || pct > 99.99) return `${pct.toFixed(4)}%`;
	return `${pct.toFixed(2)}%`;
}

export function dryCalcCommand(options: { drop_rate: string; kills: number; drops?: number }): string {
	const res = calculateDryStreak({
		dropRateInput: options.drop_rate,
		kills: options.kills,
		drops: options.drops ?? 0
	});
	if ('error' in res) return res.error;

	const lines = [
		`**OSRS Dry Calculator (${res.displayRate})**`,
		`**Kills / Rolls:** ${res.kills.toLocaleString()} | **Drops Obtained:** ${res.drops.toLocaleString()}`,
		`**Expected Drops:** ${res.expectedDrops.toFixed(2)} (${res.dryMultiple.toFixed(2)}x rate)`
	];

	if (res.drops === 0) {
		lines.push(
			`**Chance of 0 drops:** ${formatPct(res.probExactK)}`,
			`**Chance of at least 1 drop:** ${formatPct(res.probAtLeastOne)}`
		);
	} else {
		lines.push(
			`**Chance of exactly ${res.drops} drop(s):** ${formatPct(res.probExactK)}`,
			`**Chance of ${res.drops} or fewer drops:** ${formatPct(res.probAtMostK)}`,
			`**Chance of more than ${res.drops} drops:** ${formatPct(res.probMoreThanK)}`
		);
	}

	return lines.join('\n');
}

export interface ClosestCLEntry {
	name: string;
	category: string;
	obtained: number;
	total: number;
	missingCount: number;
	percent: number;
	missingItemIds: number[];
}

export function computeClosestCLs(
	clBank: Bank,
	options: { group?: string; sort?: 'percent' | 'missing'; include_zero?: boolean } = {}
): ClosestCLEntry[] {
	const entries: ClosestCLEntry[] = [];
	const sortMode = options.sort ?? 'percent';
	const includeZero = Boolean(options.include_zero);

	for (const [categoryName, categoryData] of Object.entries(allCollectionLogs)) {
		if (options.group) {
			const matchesCategory =
				stringMatches(categoryName, options.group) ||
				categoryData.alias?.some(a => stringMatches(a, options.group!));
			if (!matchesCategory) continue;
		} else if (categoryName === 'Discontinued') {
			continue;
		}

		for (const [activityName, activityData] of Object.entries(categoryData.activities)) {
			if (activityData.counts === false && !options.group) continue;
			const uniqueItems = Array.from(new Set(activityData.items));
			const total = uniqueItems.length;
			if (total === 0) continue;

			const missingItemIds: number[] = [];
			let obtained = 0;
			for (const itemId of uniqueItems) {
				if (clBank.has(itemId)) {
					obtained++;
				} else {
					missingItemIds.push(itemId);
				}
			}

			if (obtained >= total) continue;
			if (obtained === 0 && !includeZero) continue;

			const missingCount = total - obtained;
			const percent = (obtained / total) * 100;

			entries.push({
				name: activityName,
				category: categoryName,
				obtained,
				total,
				missingCount,
				percent,
				missingItemIds
			});
		}
	}

	entries.sort((a, b) => {
		if (sortMode === 'missing') {
			if (a.missingCount !== b.missingCount) return a.missingCount - b.missingCount;
			return b.percent - a.percent;
		}
		if (b.percent !== a.percent) return b.percent - a.percent;
		return a.missingCount - b.missingCount;
	});

	return entries;
}

export function closestCLCommand(
	user: MUser,
	options: { group?: string; sort?: 'percent' | 'missing'; include_zero?: boolean } = {}
): string {
	const entries = computeClosestCLs(user.cl, options);
	if (entries.length === 0) {
		return options.group
			? `No incomplete Collection Logs found for group \`${options.group}\`.`
			: 'No started, incomplete Collection Logs found. Try passing `include_zero:True` to include unstarted logs.';
	}

	const top = entries.slice(0, 15);
	const lines = top.map((entry, idx) => {
		let line = `**${idx + 1}. ${entry.name}** (${entry.category}): ${entry.obtained}/${entry.total} (${entry.percent.toFixed(1)}%)`;
		if (entry.missingCount <= 3) {
			const names = entry.missingItemIds.map(id => Items.itemNameFromId(id)).join(', ');
			line += ` - Missing: ${names}`;
		} else {
			line += ` - ${entry.missingCount} left`;
		}
		return line;
	});

	return `**Closest Collection Logs to Completion**\n${lines.join('\n')}`;
}

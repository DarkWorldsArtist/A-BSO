import { roleMention } from '@oldschoolgg/discord';
import { formatDuration, Time } from '@oldschoolgg/toolkit';

import { Channel, Roles } from '@/lib/constants.js';

export let DOUBLE_LOOT_FINISH_TIME_CACHE = 0;
export let DOUBLE_XP_FINISH_TIME_CACHE = 0;

export function isDoubleLootActive(duration = 0) {
	return Date.now() - duration < DOUBLE_LOOT_FINISH_TIME_CACHE;
}

export function isDoubleXPActive(duration = 0) {
	return Date.now() - duration < DOUBLE_XP_FINISH_TIME_CACHE;
}

export function hasUsedDoubleLootThisMonth(lastUsage: Date | null, now = Date.now()) {
	if (lastUsage === null) return false;
	const nowDate = new Date(now);
	return lastUsage.getUTCFullYear() === nowDate.getUTCFullYear() && lastUsage.getUTCMonth() === nowDate.getUTCMonth();
}

export function getNextDoubleLootUsageReset(lastUsage: Date | number) {
	const usageDate = new Date(lastUsage);
	return Date.UTC(usageDate.getUTCFullYear(), usageDate.getUTCMonth() + 1, 1);
}

export async function addDoubleTime({
	amount,
	reason,
	loot = false,
	xp = false
}: {
	amount: number;
	reason: string;
	loot?: boolean;
	xp?: boolean;
}) {
	if (!loot && !xp) return;

	const clientSettings = await ClientSettings.fetch({
		double_loot_finish_time: loot,
		double_xp_finish_time: xp
	});

	const updateData: { double_loot_finish_time?: number; double_xp_finish_time?: number } = {};
	const roles: string[] = [];
	const types: string[] = [];

	if (loot) {
		let current = Number(clientSettings.double_loot_finish_time);
		if (current < Date.now()) {
			current = Date.now();
		}
		const newDoubleLootTimer = current + amount;
		updateData.double_loot_finish_time = newDoubleLootTimer;
		DOUBLE_LOOT_FINISH_TIME_CACHE = newDoubleLootTimer;
		roles.push(Roles.BSODoubleLoot);
		types.push('Double Loot');
	}

	if (xp) {
		let current = Number(clientSettings.double_xp_finish_time);
		if (current < Date.now()) {
			current = Date.now();
		}
		const newDoubleXpTimer = current + amount;
		updateData.double_xp_finish_time = newDoubleXpTimer;
		DOUBLE_XP_FINISH_TIME_CACHE = newDoubleXpTimer;
		roles.push(Roles.BSODoubleXP);
		types.push('Double XP');
	}

	await ClientSettings.update(updateData);

	const roleMentions = roles.map(r => roleMention(r)).join(' ');
	const typeStr = types.join(' and ');

	await globalClient.sendMessage(Channel.GeneralChannel, {
		content: `${roleMentions} ${formatDuration(amount)} added to the ${typeStr} timer because: ${reason}.`,
		allowedMentions: { roles }
	});

	await syncPrescence();
}

export async function addToDoubleLootTimer(amount: number, reason: string) {
	return addDoubleTime({ amount, reason, loot: true });
}

export async function addToDoubleXpTimer(amount: number, reason: string) {
	return addDoubleTime({ amount, reason, xp: true });
}

export async function addPatronLootTime(_tier: number, user: MUser | null) {
	const map: Record<number, number> = {
		1: 3,
		2: 6,
		3: 15,
		4: 25,
		5: 60
	};
	const tier = _tier - 1;
	if (!map[tier]) return;
	const minutes = map[tier];
	const timeAdded = Math.floor(Time.Minute * minutes);
	await addToDoubleLootTimer(timeAdded, `${user ?? 'Someone'} became a Tier ${tier} sponsor`);
}

export async function syncDoubleLoot() {
	const clientSettings = await ClientSettings.fetch({
		double_loot_finish_time: true
	});
	DOUBLE_LOOT_FINISH_TIME_CACHE = Number(clientSettings.double_loot_finish_time);
}

export async function syncDoubleXP() {
	const clientSettings = await ClientSettings.fetch({
		double_xp_finish_time: true
	});
	DOUBLE_XP_FINISH_TIME_CACHE = Number(clientSettings.double_xp_finish_time);
}

let currentPresenceText = '';

export async function syncPrescence() {
	await Promise.all([syncDoubleLoot(), syncDoubleXP()]);

	const dlActive = isDoubleLootActive();
	const dxpActive = isDoubleXPActive();

	let str = '/help';
	if (dlActive && dxpActive) {
		str = `${formatDuration(DOUBLE_LOOT_FINISH_TIME_CACHE - Date.now(), true)} Double Loot | ${formatDuration(DOUBLE_XP_FINISH_TIME_CACHE - Date.now(), true)} Double XP!`;
	} else if (dlActive) {
		str = `${formatDuration(DOUBLE_LOOT_FINISH_TIME_CACHE - Date.now(), true)} Double Loot!`;
	} else if (dxpActive) {
		str = `${formatDuration(DOUBLE_XP_FINISH_TIME_CACHE - Date.now(), true)} Double XP!`;
	}

	if (str !== currentPresenceText) {
		currentPresenceText = str;
		await globalClient.setPresence({
			text: str
		});
	}
}

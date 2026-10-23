import { formatDuration, Time } from '@oldschoolgg/toolkit';
import type { Prisma } from '@prisma/robochimp';

type PatronTimeClient = typeof roboChimpClient | Prisma.TransactionClient;

export const validPatronTimeTiers = [1, 2, 3, 4, 5, 6, 7] as const;

export type PatronTimeBalance = {
	premium_balance_tier: number | null;
	premium_balance_expiry_date: bigint | null;
};

export type PatronTimeGrant = {
	expiryTime: number;
	remainingTime: number;
	tier: number;
	timeMs: number;
};

export function validatePatronTimeGrant(timeMs: number, tier: number) {
	return (
		validPatronTimeTiers.includes(tier as (typeof validPatronTimeTiers)[number]) &&
		timeMs >= Time.Second &&
		timeMs <= Time.Year * 3
	);
}

export async function fetchPatronTimeBalance(userID: bigint): Promise<PatronTimeBalance> {
	return roboChimpClient.user.findUniqueOrThrow({
		where: {
			id: userID
		},
		select: {
			premium_balance_tier: true,
			premium_balance_expiry_date: true
		}
	});
}

export function calculatePatronTimeGrant({
	currentBalance,
	timeMs,
	tier,
	now = Date.now()
}: {
	currentBalance: PatronTimeBalance;
	timeMs: number;
	tier: number;
	now?: number;
}): PatronTimeGrant {
	const currentBalanceTime =
		currentBalance.premium_balance_expiry_date === null ? null : Number(currentBalance.premium_balance_expiry_date);
	const expiryTime =
		currentBalanceTime !== null && tier === currentBalance.premium_balance_tier
			? currentBalanceTime + timeMs
			: now + timeMs;

	return {
		expiryTime,
		remainingTime: expiryTime - now,
		tier,
		timeMs
	};
}

export function patronTimeGrantUpdate(grant: PatronTimeGrant) {
	return {
		premium_balance_tier: grant.tier,
		premium_balance_expiry_date: grant.expiryTime
	};
}

export async function applyPatronTimeGrant({
	client = roboChimpClient,
	userID,
	grant
}: {
	client?: PatronTimeClient;
	userID: bigint;
	grant: PatronTimeGrant;
}) {
	return client.user.update({
		where: {
			id: userID
		},
		data: patronTimeGrantUpdate(grant)
	});
}

export async function grantPatronTime({
	userID,
	timeMs,
	tier,
	now = Date.now()
}: {
	userID: bigint;
	timeMs: number;
	tier: number;
	now?: number;
}) {
	if (!validatePatronTimeGrant(timeMs, tier)) {
		throw new Error('Invalid temporary patron grant.');
	}

	const currentBalance = await fetchPatronTimeBalance(userID);
	const grant = calculatePatronTimeGrant({ currentBalance, timeMs, tier, now });

	await applyPatronTimeGrant({ userID, grant });
	await globalClient.fetchRUser(userID);
	return grant;
}

export function formatPatronTimeGrant(grant: PatronTimeGrant) {
	return `${formatDuration(grant.timeMs)} of Tier ${grant.tier}`;
}

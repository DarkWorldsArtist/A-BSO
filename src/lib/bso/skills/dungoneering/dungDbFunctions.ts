import type { DungeoneeringOptions } from '@/lib/bso/bsoTypes.js';
import { gorajanArcherOutfit, gorajanOccultOutfit, gorajanWarriorOutfit } from '@/lib/bso/collection-log/main.js';
import { requiredSkills } from '@/lib/bso/skills/dungoneering/dungData.js';

import { reduceNumByPercent } from '@oldschoolgg/toolkit';
import { convertLVLtoXP } from 'oldschooljs';

export function hasRequiredLevels(user: MUser, floor: number) {
	return user.hasSkillReqs(requiredSkills(floor));
}

export function calcMaxFloorUserCanDo(user: MUser) {
	return [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].find(floor => hasRequiredLevels(user, floor)) || 1;
}

export const gorajanShardXpBreakpoints = [
	{ xp: 13_034_431, boost: 3 },
	{ xp: 41_741_757, boost: 7 },
	{ xp: 104_273_167, boost: 13 },
	{ xp: 200_000_000, boost: 18 },
	{ xp: 350_000_000, boost: 24 },
	{ xp: 500_000_000, boost: 30 }
];

export function calcGorajanShardXpBoost(dgXp: number): number {
	if (dgXp < gorajanShardXpBreakpoints[0].xp) return 0;
	if (dgXp >= 500_000_000) return 30;

	for (let i = 0; i < gorajanShardXpBreakpoints.length - 1; i++) {
		const curr = gorajanShardXpBreakpoints[i];
		const next = gorajanShardXpBreakpoints[i + 1];
		if (dgXp >= curr.xp && dgXp <= next.xp) {
			const progress = (dgXp - curr.xp) / (next.xp - curr.xp);
			const boost = curr.boost + progress * (next.boost - curr.boost);
			return Number(boost.toFixed(1));
		}
	}
	return 30;
}

export function calcUserGorajanShardChance(user: MUser, floor = 6) {
	return calcGorajanShardChance({
		floor,
		dgXp: user.skillsAsXP.dungeoneering,
		dungLevel: user.skillsAsLevels.dungeoneering,
		hasRingOfLuck: user.hasEquippedOrInBank('Ring of luck'),
		hasAlyra: user.hasEquippedOrInBank('Alyra') || user.usingPet('Alyra')
	});
}

const floorBaseShardRates: Record<number, number> = {
	6: 1000,
	7: 800,
	8: 600,
	9: 450,
	10: 300
};

export function calcGorajanShardChance({
	floor = 6,
	dgXp,
	dungLevel,
	hasRingOfLuck = false,
	hasAlyra = false
}: {
	floor?: number;
	dgXp?: number;
	dungLevel?: number;
	hasMasterCape?: boolean;
	hasRingOfLuck?: boolean;
	hasAlyra?: boolean;
}) {
	const goraShardBoosts = [];
	let baseRate = floorBaseShardRates[floor] ?? 1000;
	if (hasAlyra) {
		baseRate = reduceNumByPercent(baseRate, 10);
		goraShardBoosts.push('10% for Alyra');
	}

	const effectiveXp = dgXp ?? (dungLevel ? convertLVLtoXP(dungLevel) : 0);
	const xpBoost = calcGorajanShardXpBoost(effectiveXp);
	if (xpBoost > 0) {
		baseRate = reduceNumByPercent(baseRate, xpBoost);
		goraShardBoosts.push(`${xpBoost}% for DG level/XP`);
	}

	if (hasRingOfLuck) {
		baseRate = reduceNumByPercent(baseRate, 5);
		goraShardBoosts.push('5% for Ring of Luck');
	}
	return {
		chance: baseRate,
		boosts: goraShardBoosts
	};
}

const data = [
	[gorajanWarriorOutfit, 'melee'],
	[gorajanOccultOutfit, 'mage'],
	[gorajanArcherOutfit, 'range']
] as const;

export function numberOfGorajanOutfitsEquipped(user: MUser) {
	let num = 0;
	for (const outfit of data) {
		if (user.gear[outfit[1]].hasEquipped(outfit[0], true)) num++;
	}
	return num;
}

export async function getDungeoneeringFloorCompletions(user: MUser): Promise<Record<number, number>> {
	const floorCounts: Record<number, number> = {
		1: 0,
		2: 0,
		3: 0,
		4: 0,
		5: 0,
		6: 0,
		7: 0,
		8: 0,
		9: 0,
		10: 0
	};
	if (typeof prisma === 'undefined' || !prisma?.activity?.findMany) return floorCounts;
	const activities = await prisma.activity.findMany({
		where: {
			type: 'Dungeoneering',
			completed: true,
			all_user_ids: {
				has: BigInt(user.id)
			}
		},
		select: {
			data: true
		}
	});
	for (const act of activities) {
		const actData = act.data as unknown as DungeoneeringOptions;
		const floor = actData.floor ?? 1;
		const qty = actData.quantity ?? 1;
		floorCounts[floor] = (floorCounts[floor] ?? 0) + qty;
	}
	return floorCounts;
}

export async function getDungeoneeringFloorCount(user: MUser): Promise<number> {
	const completions = await getDungeoneeringFloorCompletions(user);
	return Object.values(completions).reduce((a, b) => a + b, 0);
}

export interface KinshipFloorSpreadReq {
	minCompletions: number;
	maxFloor: number;
}

export function checkKinshipFloorSpread(
	floorCounts: Record<number, number>,
	req: KinshipFloorSpreadReq
): { hasSpread: boolean; missing: { floor: number; current: number; required: number }[] } {
	const missing: { floor: number; current: number; required: number }[] = [];
	for (let f = 1; f <= req.maxFloor; f++) {
		const current = floorCounts[f] ?? 0;
		if (current < req.minCompletions) {
			missing.push({ floor: f, current, required: req.minCompletions });
		}
	}
	return {
		hasSpread: missing.length === 0,
		missing
	};
}

export interface KinshipTierInfo {
	tier: number;
	name: string;
	speedBoost: number;
	nextTierName: string | null;
	reqFloors: number;
	reqTokens: number;
	reqDgLevel: number;
	extraReqDesc: string | null;
	floorSpreadReq?: KinshipFloorSpreadReq;
}

export const kinshipTiers: readonly KinshipTierInfo[] = [
	{
		tier: 1,
		name: 'Ring of kinship (tier 1)',
		speedBoost: 5,
		nextTierName: 'Ring of kinship (tier 2)',
		reqFloors: 50,
		reqTokens: 50_000,
		reqDgLevel: 50,
		extraReqDesc: null,
		floorSpreadReq: {
			minCompletions: 10,
			maxFloor: 4
		}
	},
	{
		tier: 2,
		name: 'Ring of kinship (tier 2)',
		speedBoost: 6,
		nextTierName: 'Ring of kinship (tier 3)',
		reqFloors: 150,
		reqTokens: 100_000,
		reqDgLevel: 80,
		extraReqDesc: null,
		floorSpreadReq: {
			minCompletions: 20,
			maxFloor: 6
		}
	},
	{
		tier: 3,
		name: 'Ring of kinship (tier 3)',
		speedBoost: 7,
		nextTierName: 'Ring of kinship (tier 4)',
		reqFloors: 300,
		reqTokens: 200_000,
		reqDgLevel: 100,
		extraReqDesc: null,
		floorSpreadReq: {
			minCompletions: 30,
			maxFloor: 8
		}
	},
	{
		tier: 4,
		name: 'Ring of kinship (tier 4)',
		speedBoost: 8,
		nextTierName: 'Overcharged ring of kinship',
		reqFloors: 500,
		reqTokens: 0,
		reqDgLevel: 118,
		extraReqDesc: 'Kinship overcharger (500k tokens from /dg buy)',
		floorSpreadReq: {
			minCompletions: 40,
			maxFloor: 10
		}
	},
	{
		tier: 5,
		name: 'Overcharged ring of kinship',
		speedBoost: 10,
		nextTierName: null,
		reqFloors: 500,
		reqTokens: 0,
		reqDgLevel: 118,
		extraReqDesc: null
	}
] as const;

export function getCurrentKinshipTier(user: MUser): KinshipTierInfo | null {
	if (user.hasEquippedOrInBank('Overcharged ring of kinship')) {
		return kinshipTiers[4];
	}
	if (user.hasEquippedOrInBank('Ring of kinship (tier 4)')) {
		return kinshipTiers[3];
	}
	if (user.hasEquippedOrInBank('Ring of kinship (tier 3)')) {
		return kinshipTiers[2];
	}
	if (user.hasEquippedOrInBank('Ring of kinship (tier 2)')) {
		return kinshipTiers[1];
	}
	if (user.hasEquippedOrInBank('Ring of kinship (tier 1)')) {
		return kinshipTiers[0];
	}
	return null;
}

export function getMissingSkillsForFloor(
	user: MUser,
	floor: number
): { skill: string; required: number; current: number }[] {
	const reqs = requiredSkills(floor);
	const missing: { skill: string; required: number; current: number }[] = [];
	for (const [skill, level] of Object.entries(reqs)) {
		const userLevel = user.skillsAsLevels[skill as keyof typeof user.skillsAsLevels] ?? 0;
		if (userLevel < level) {
			missing.push({ skill, required: level, current: userLevel });
		}
	}
	return missing;
}

import { Time, uniqueArr } from '@oldschoolgg/toolkit';
import { LRUCache } from 'lru-cache';

import { BitField, BOT_TYPE, globalConfig, PatronRoleTiers, PerkTier } from '@/lib/constants.js';
import type { RobochimpUser } from '@/lib/roboChimp.js';

export const RobochimpBitfieldEnum = {
	PatronTier1: 17,
	PatronTier2: 18,
	PatronTier3: 19,
	PatronTier4: 20,
	PatronTier5: 21,
	PatronTier6: 22,
	PatronTier7: 23,
	OriginalSupporter: 24,
	BonusMinute: 25
};

const PATRON_TIER_BITS = [
	{ bit: RobochimpBitfieldEnum.PatronTier7, number: 7 },
	{ bit: RobochimpBitfieldEnum.PatronTier6, number: 6 },
	{ bit: RobochimpBitfieldEnum.PatronTier5, number: 5 },
	{ bit: RobochimpBitfieldEnum.PatronTier4, number: 4 },
	{ bit: RobochimpBitfieldEnum.PatronTier3, number: 3 },
	{ bit: RobochimpBitfieldEnum.PatronTier2, number: 2 },
	{ bit: RobochimpBitfieldEnum.PatronTier1, number: 1 }
] as const;

type PerkTierHotCacheEntry = {
	tier: number;
	expires: number;
};
const PerkTierHotTTL = Time.Hour * 2;

const perkTierHotCache = new LRUCache<string, PerkTierHotCacheEntry>({
	max: 10_000,
	ttl: Time.Minute * 60,
	updateAgeOnGet: false
});

function setHotCache(userId: string, tier: number) {
	perkTierHotCache.set(userId, { tier, expires: Date.now() + PerkTierHotTTL });
}
export function getPerkTierCached(userId: string) {
	const tierCacheEntry = perkTierHotCache.get(userId);
	if (tierCacheEntry) {
		return tierCacheEntry.tier;
	}
	return null;
}

export function getRoboChimpPaidTierDisplay(bits: number[], { perkTier }: { perkTier?: number | null }): string;
export function getRoboChimpPaidTierDisplay(user: RobochimpUser, { perkTier }: { perkTier?: number | null }): string;
export function getRoboChimpPaidTierDisplay(
	bitsOrUser: number[] | RobochimpUser | null | undefined,
	{
		perkTier
	}: {
		perkTier?: number | null;
	}
) {
	const bits = bitsOrUser && 'bits' in bitsOrUser ? bitsOrUser.bits : bitsOrUser;
	if (!bits || bits.length === 0) {
		return perkTier && perkTier > 1 ? `Tier ${perkTier - 1} patron` : 'None';
	}

	const labels = uniqueArr(
		PATRON_TIER_BITS.filter(tier => bits.includes(tier.bit)).map(tier => `Tier ${tier.number} patron`)
	);

	if (bits.includes(RobochimpBitfieldEnum.BonusMinute)) {
		labels.push('*Bonus Minute??*');
	}

	return labels.length === 0
		? perkTier && perkTier > 1
			? `Tier ${perkTier - 1} patron`
			: 'None'
		: labels.join(', ');
}

export async function getUsersPerkTier({
	user,
	forceNoCache
}: {
	user: MUser;
	forceNoCache?: boolean;
}): Promise<PerkTier> {
	if (!forceNoCache) {
		// We want a way to force a cache refresh
		// Otherwise, we look for a cached tier:
		const tierCacheEntry = perkTierHotCache.get(user.id);
		// If it's not expired, return it:
		if (tierCacheEntry && tierCacheEntry.expires > Date.now()) {
			return tierCacheEntry.tier;
		}
		const redisCacheEntry = await Cache.getPerkTier(user.id);
		if (redisCacheEntry) {
			setHotCache(user.id, redisCacheEntry);
			return redisCacheEntry;
		}
	}

	const eligibleTiers = [];
	if (user.isContributor || user.isModOrAdmin || user.isWikiContrib) {
		eligibleTiers.push(PerkTier.Four);
	} else if (user.isTrusted) {
		eligibleTiers.push(PerkTier.Three);
	}

	const bitfield = user.bitfield;

	// TODO: Remove these tiers:
	// Courtesy tiers.
	if (bitfield.includes(BitField.PatronTier6)) {
		eligibleTiers.push(PerkTier.Seven);
	}

	if (bitfield.includes(BitField.PatronTier5)) {
		eligibleTiers.push(PerkTier.Six);
	}

	if (bitfield.includes(BitField.PatronTier4)) {
		eligibleTiers.push(PerkTier.Five);
	}

	if (bitfield.includes(BitField.PatronTier3)) {
		eligibleTiers.push(PerkTier.Four);
	}

	if (bitfield.includes(BitField.PatronTier2)) {
		eligibleTiers.push(PerkTier.Three);
	}
	// END TODO

	const roboChimpCached = await Cache.getRoboChimpUser(user.id);
	if (roboChimpCached) {
		eligibleTiers.push(roboChimpCached.perk_tier);
		if (
			roboChimpCached.premium_balance_tier &&
			roboChimpCached.premium_balance_expiry_date &&
			Number(roboChimpCached.premium_balance_expiry_date) > Date.now()
		) {
			eligibleTiers.push(roboChimpCached.premium_balance_tier);
		}
	}

	const supportMember = await Cache.getMember({ guildId: globalConfig.supportServerID, userId: user.id }).catch(
		() => null
	);
	if (supportMember?.roles) {
		for (const roleTier of PatronRoleTiers) {
			if (supportMember.roles.includes(roleTier.roleId)) {
				eligibleTiers.push(roleTier.perkTier);
				if (roboChimpCached && !roboChimpCached.bits.includes(roleTier.bit)) {
					roboChimpCached.bits.push(roleTier.bit);
				}
				break;
			}
		}
	}

	if (bitfield.includes(BitField.HasPermanentTierOne)) {
		if (BOT_TYPE === 'BSO') {
			eligibleTiers.push(PerkTier.Three);
		} else {
			eligibleTiers.push(PerkTier.Two);
		}
	}
	if (bitfield.includes(BitField.PatronTier1) || bitfield.includes(BitField.BothBotsMaxedFreeTierOnePerks)) {
		eligibleTiers.push(PerkTier.Two);
	}
	// Server boosting perk has been eliminated
	const tier = Math.max(...eligibleTiers, 0);
	setHotCache(user.id, tier);
	await Cache.setPerkTier(user.id, tier);
	return tier;
}

import { PerkTier, uniqueArr } from '@oldschoolgg/toolkit';

export enum Bits {
	Admin = 1,
	Moderator = 2,
	Trusted = 3,
	WikiContributor = 4,
	Contributor = 5,
	BothBotsMaxedFreeTierOnePerks = 6,
	HasPermanentTierOne = 7,
	HasEverBeenPatron = 14,
	SupportStaff = 15,
	PatronTier1 = 17,
	PatronTier2 = 18,
	PatronTier3 = 19,
	PatronTier4 = 20,
	PatronTier5 = 21,
	PatronTier6 = 22,
	PatronTier7 = 23,
	OriginalSupporter = 24,
	BonusMinute = 25
}
type BitDescriptions = {
	[K in Bits]: { description: string };
};

export const bitsDescriptions: BitDescriptions = {
	[Bits.Admin]: { description: 'Admin' },
	[Bits.Moderator]: { description: 'Moderator' },
	[Bits.SupportStaff]: { description: 'Support Staff' },
	[Bits.Trusted]: { description: 'Trusted' },
	[Bits.WikiContributor]: { description: 'Wiki Contributor' },
	[Bits.Contributor]: { description: 'Contributor' },
	[Bits.BothBotsMaxedFreeTierOnePerks]: { description: 'Maxed patron perks for both bots' },
	[Bits.HasPermanentTierOne]: { description: 'Has permanent Tier 1 perks' },
	[Bits.HasEverBeenPatron]: { description: 'Has been a patron before' },
	[Bits.PatronTier1]: { description: 'Tier 1 patron' },
	[Bits.PatronTier2]: { description: 'Tier 2 patron' },
	[Bits.PatronTier3]: { description: 'Tier 3 patron' },
	[Bits.PatronTier4]: { description: 'Tier 4 patron' },
	[Bits.PatronTier5]: { description: 'Tier 5 patron' },
	[Bits.PatronTier6]: { description: 'Tier 6 patron' },
	[Bits.PatronTier7]: { description: 'Tier 7 patron' },
	[Bits.OriginalSupporter]: { description: 'Original Supporter' },
	[Bits.BonusMinute]: { description: 'Bonus minute' }
};

export const CHANNELS = {
	BLACKLIST_LOGS: '782459317218967602',
	MODERATORS_OTHER: '830145040495411210',
	MODERATORS: '655880227469131777',
	TESTING_AWARDS: '1195579189714243685',
	DEVELOPERS: '648196527294251020',
	ALL_SUPPORT_STAFF: '1482212223085580442',
	MODERATORS_COMMANDS: '1457789366330986608'
};

export interface PatronTier {
	id?: string;
	bit: Bits;
	perkTier: PerkTier;
	number: number;
}

export const patronTiers: PatronTier[] = [
	{ bit: Bits.PatronTier7, perkTier: PerkTier.Seven, number: 7 },
	{ bit: Bits.PatronTier6, perkTier: PerkTier.Seven, number: 6 },
	{ bit: Bits.PatronTier5, perkTier: PerkTier.Six, number: 5 },
	{ bit: Bits.PatronTier4, perkTier: PerkTier.Five, number: 4 },
	{ bit: Bits.PatronTier3, perkTier: PerkTier.Four, number: 3 },
	{ bit: Bits.PatronTier2, perkTier: PerkTier.Three, number: 2 },
	{ bit: Bits.PatronTier1, perkTier: PerkTier.Two, number: 1 }
];

export const tiers: PatronTier[] = patronTiers;
export const paidTiers: PatronTier[] = patronTiers;
export const allPatronBits: Bits[] = patronTiers.map(t => t.bit);

export function getPatronTierLabel(tier: Pick<PatronTier, 'number'>) {
	return `Tier ${tier.number} patron`;
}

export function getUserPaidTiers(bits: readonly number[]): PatronTier[] {
	return patronTiers.filter(tier => bits.includes(tier.bit));
}

export function formatUserPaidTiers(bits: readonly number[]) {
	const labels = uniqueArr(
		getUserPaidTiers(bits)
			.sort((a, b) => {
				if (b.perkTier !== a.perkTier) return b.perkTier - a.perkTier;
				return b.number - a.number;
			})
			.map(getPatronTierLabel)
	);
	return labels.length === 0 ? 'None' : labels.join(', ');
}

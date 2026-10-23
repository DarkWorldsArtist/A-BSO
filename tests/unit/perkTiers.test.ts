import { PerkTier, Time } from '@oldschoolgg/toolkit';
import { describe, expect, test } from 'vitest';

import { getRoboChimpPaidTierDisplay } from '@/lib/perkTiers.js';
import { patronMaxTripBonus } from '@/lib/util/calcMaxTripLength.js';

describe('perk tier helpers', () => {
	test('formats robochimp paid tier labels', () => {
		expect(getRoboChimpPaidTierDisplay([19], { perkTier: 4 })).toBe('Tier 3 patron');
		expect(getRoboChimpPaidTierDisplay([], { perkTier: 4 })).toBe('Tier 3 patron');
		expect(getRoboChimpPaidTierDisplay([], { perkTier: 0 })).toBe('None');
	});

	test('computes patron trip bonus from perk tier', () => {
		expect(patronMaxTripBonus(PerkTier.Two)).toBe(Time.Minute * 3);
		expect(patronMaxTripBonus(PerkTier.Three)).toBe(Time.Minute * 6);
		expect(patronMaxTripBonus(PerkTier.Four)).toBe(Time.Minute * 15);
		expect(patronMaxTripBonus(PerkTier.Five)).toBe(Time.Minute * 20);
		expect(patronMaxTripBonus(PerkTier.Six)).toBe(Time.Minute * 25);
		expect(patronMaxTripBonus(PerkTier.Seven)).toBe(Time.Minute * 25);
	});
});

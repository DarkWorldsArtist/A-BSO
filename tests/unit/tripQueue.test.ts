import { PerkTier, Time } from '@oldschoolgg/toolkit';
import { describe, expect, test } from 'vitest';

import {
	DAILY_QUEUE_CAP,
	describeActivity,
	getDailyQueuedTripsRemaining,
	getDailyQueuedTripsUsed,
	getESTDateKey,
	getMaxQueueDepth
} from '../../src/lib/tripQueue.js';
import { calcMaxTripLength, patronMaxTripBonus } from '../../src/lib/util/calcMaxTripLength.js';
import { mockMUser } from './userutil.js';

describe('Trip Queueing System', () => {
	describe('getMaxQueueDepth', () => {
		test('enforces tier requirements and depth caps', () => {
			expect(getMaxQueueDepth(PerkTier.Zero)).toBe(0);
			expect(getMaxQueueDepth(PerkTier.One)).toBe(0);
			expect(getMaxQueueDepth(PerkTier.Two)).toBe(0);
			expect(getMaxQueueDepth(PerkTier.Three)).toBe(0);
			expect(getMaxQueueDepth(PerkTier.Four)).toBe(1); // Tier 3 Patron
			expect(getMaxQueueDepth(PerkTier.Five)).toBe(2); // Tier 4 Patron
			expect(getMaxQueueDepth(PerkTier.Six)).toBe(4); // Tier 5 Patron
			expect(getMaxQueueDepth(PerkTier.Seven)).toBe(4);
		});
	});

	describe('EST Daily Cap and Reset', () => {
		test('calculates EST date key correctly around midnight', () => {
			// In EDT (UTC-4):
			// 03:59 UTC on Oct 18 is 23:59 EDT on Oct 17
			const beforeMidnightEDT = new Date('2026-10-18T03:59:00.000Z');
			expect(getESTDateKey(beforeMidnightEDT)).toBe('2026-10-17');

			// 04:00 UTC on Oct 18 is 00:00 EDT on Oct 18
			const atMidnightEDT = new Date('2026-10-18T04:00:00.000Z');
			expect(getESTDateKey(atMidnightEDT)).toBe('2026-10-18');
		});

		test('calculates daily trips used and remaining correctly', () => {
			const today = getESTDateKey();

			// User with no previous queue runs
			const mockUserNew = {
				user: {
					queued_trips_daily_date: null,
					queued_trips_daily_count: 0
				}
			} as any;
			expect(getDailyQueuedTripsUsed(mockUserNew)).toBe(0);
			expect(getDailyQueuedTripsRemaining(mockUserNew)).toBe(DAILY_QUEUE_CAP);

			// User with yesterday's runs (resets automatically)
			const mockUserYesterday = {
				user: {
					queued_trips_daily_date: '2026-10-17',
					queued_trips_daily_count: 4
				}
			} as any;
			expect(getDailyQueuedTripsUsed(mockUserYesterday)).toBe(0);
			expect(getDailyQueuedTripsRemaining(mockUserYesterday)).toBe(DAILY_QUEUE_CAP);

			// User with 2 runs today
			const mockUserToday = {
				user: {
					queued_trips_daily_date: today,
					queued_trips_daily_count: 2
				}
			} as any;
			expect(getDailyQueuedTripsUsed(mockUserToday)).toBe(2);
			expect(getDailyQueuedTripsRemaining(mockUserToday)).toBe(2);

			// User at daily cap
			const mockUserMaxed = {
				user: {
					queued_trips_daily_date: today,
					queued_trips_daily_count: 4
				}
			} as any;
			expect(getDailyQueuedTripsUsed(mockUserMaxed)).toBe(4);
			expect(getDailyQueuedTripsRemaining(mockUserMaxed)).toBe(0);
		});
	});

	describe('Patron Trip Length Bonuses', () => {
		test('scales trip bonus according to requested tiers', () => {
			expect(patronMaxTripBonus(PerkTier.Zero)).toBe(0);
			expect(patronMaxTripBonus(PerkTier.One)).toBe(0);
			expect(patronMaxTripBonus(PerkTier.Two)).toBe(Time.Minute * 3); // Tier 1 Patron
			expect(patronMaxTripBonus(PerkTier.Three)).toBe(Time.Minute * 6); // Tier 2 Patron
			expect(patronMaxTripBonus(PerkTier.Four)).toBe(Time.Minute * 15); // Tier 3 Patron
			expect(patronMaxTripBonus(PerkTier.Five)).toBe(Time.Minute * 20); // Tier 4 Patron
			expect(patronMaxTripBonus(PerkTier.Six)).toBe(Time.Minute * 25); // Tier 5 Patron
			expect(patronMaxTripBonus(PerkTier.Seven)).toBe(Time.Minute * 25);
		});

		test('calculates max trip length with patron bonuses', async () => {
			(globalThis as any).Cache = {
				getRoboChimpUser: async () => ({ bits: [] })
			};

			const mockUserT5 = mockMUser();
			mockUserT5.fetchPerkTier = async () => PerkTier.Six;
			const maxTripT5 = await calcMaxTripLength(mockUserT5);
			// Base (30m) + T5 bonus (25m) = 55m
			expect(maxTripT5).toBe(Time.Minute * 55);

			const mockUserT4 = mockMUser();
			mockUserT4.fetchPerkTier = async () => PerkTier.Five;
			const maxTripT4 = await calcMaxTripLength(mockUserT4);
			// Base (30m) + T4 bonus (20m) = 50m
			expect(maxTripT4).toBe(Time.Minute * 50);

			const mockUserT0 = mockMUser();
			mockUserT0.fetchPerkTier = async () => PerkTier.Zero;
			const maxTripT0 = await calcMaxTripLength(mockUserT0);
			// Base (30m) + T0 bonus (0m) = 30m
			expect(maxTripT0).toBe(Time.Minute * 30);
		});
	});

	describe('describeActivity', () => {
		test('formats activity titles descriptively', () => {
			expect(describeActivity({ type: 'MonsterKilling' as any, data: { monsterID: 80000, quantity: 5 } })).toBe(
				'Monster Killing'
			);
			expect(describeActivity({ type: 'Raids' as any })).toBe('Chambers of Xeric');
			expect(describeActivity({ type: 'TheatreOfBlood' as any })).toBe('Theatre of Blood');
			expect(describeActivity({ type: 'TombsOfAmascut' as any })).toBe('Tombs of Amascut');
			expect(describeActivity({ type: 'Colosseum' as any })).toBe('Fortis Colosseum');
			expect(describeActivity({ type: 'Inferno' as any })).toBe('Inferno');
			expect(describeActivity({ type: 'Gauntlet' as any, data: { corrupted: true } })).toBe('Corrupted Gauntlet');
			expect(describeActivity({ type: 'Gauntlet' as any, data: { corrupted: false } })).toBe('The Gauntlet');
			expect(describeActivity({ type: 'Wintertodt' as any })).toBe('Wintertodt');
			expect(describeActivity({ type: 'Tempoross' as any })).toBe('Tempoross');
			expect(describeActivity({ type: 'Nightmare' as any, data: { isSanctuary: true } })).toBe('Ash Sanctuary');
			expect(describeActivity({ type: 'Nightmare' as any, data: { isSanctuary: false } })).toBe('The Nightmare');
			expect(describeActivity({ type: 'Fishing' as any, data: { fishID: 'Lobster' } })).toBe('Lobster Fishing');
			expect(describeActivity({ type: 'Fishing' as any, data: { identifier: 'Lobster' } })).toBe(
				'Lobster Fishing'
			);
			expect(describeActivity({ type: 'Fishing' as any, data: { fishID: 'Barbarian fishing' } })).toBe(
				'Barbarian fishing'
			);
			expect(describeActivity({ type: 'Fishing' as any, data: {} })).toBe('Fishing');
		});
	});
});

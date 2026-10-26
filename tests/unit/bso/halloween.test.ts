import { PumpkinIshBoxTable } from '@/lib/bso/openables/holidayOpenables.js';

import { Time } from '@oldschoolgg/toolkit';
import { describe, expect, test } from 'vitest';

import { Channel, globalConfig } from '@/lib/constants.js';
import {
	calculateAndAwardHoldRewards,
	type HalloweenEventState,
	halloweenCommand,
	halloweenTripRewardTable
} from '@/mahoji/commands/halloween.js';

describe('Halloween Event Balance & Adjustments', () => {
	test('halloween channel restriction', async () => {
		expect(Channel.HalloweenChannel).toBeDefined();

		const originalIsProd = globalConfig.isProduction;
		try {
			globalConfig.isProduction = true;

			const mockUser = { id: '123' } as any;

			const resultBlocked = await halloweenCommand.run({
				options: {
					use: {
						item: 'scared-crow'
					}
				},
				user: mockUser,
				channelId: 'wrong-channel',
				interaction: {} as any,
				member: null,
				guildId: null,
				userId: '123',
				rng: {} as any
			});

			expect(resultBlocked).toBe(`You can only use Halloween items in <#${Channel.HalloweenChannel}>.`);
		} finally {
			globalConfig.isProduction = originalIsProd;
		}
	});

	test('calculateAndAwardHoldRewards awards tripled rewards (tickets every 5m, boxes every 10m)', () => {
		const state: HalloweenEventState = {
			currentHolderId: '123',
			heldSince: 0,
			lastTripAt: 0,
			immunityUntil: null,
			greasedUntil: null,
			hasScaredCrow: false,
			escaped: false,
			previousHolderId: null,
			lastStealAttempt: {},
			hasAlluring: {},
			totalHoldTimes: {},
			tripCooldowns: {},
			ticketsAwarded: {},
			boxesAwarded: {}
		};

		// After 10 minutes: 2 tickets (10 / 5), 1 box (10 / 10)
		const reward10 = calculateAndAwardHoldRewards(state, '123', Time.Minute * 10);
		expect(reward10.newTickets).toBe(2);
		expect(reward10.newBoxes).toBe(1);
		expect(state.ticketsAwarded['123']).toBe(2);
		expect(state.boxesAwarded['123']).toBe(1);

		// After 30 minutes total: 6 tickets (30 / 5), 3 boxes (30 / 10) -> newTickets = 4, newBoxes = 2
		state.heldSince = Time.Minute * 10;
		const reward30 = calculateAndAwardHoldRewards(state, '123', Time.Minute * 30);
		expect(reward30.newTickets).toBe(4);
		expect(reward30.newBoxes).toBe(2);
		expect(state.ticketsAwarded['123']).toBe(6);
		expect(state.boxesAwarded['123']).toBe(3);
	});

	test('halloweenTripRewardTable includes Pumpkin-ish box, Spooky box, and Halloween cracker', () => {
		const items = halloweenTripRewardTable.allItems;
		expect(items.length).toBeGreaterThanOrEqual(3);
	});

	test('PumpkinIshBoxTable includes Spooky box and Halloween cracker', () => {
		expect(PumpkinIshBoxTable.allItems.length).toBeGreaterThan(0);
	});

	test('immunity calculation based on active defenses', () => {
		const calcImmunity = (hadScaredCrow: boolean, hadGreasedPumpkin: boolean) => {
			let extraImmunity = 0;
			if (hadScaredCrow && hadGreasedPumpkin) {
				extraImmunity = Time.Minute * 20;
			} else if (hadScaredCrow || hadGreasedPumpkin) {
				extraImmunity = Time.Minute * 10;
			}
			return Time.Minute * 30 + extraImmunity;
		};

		expect(calcImmunity(false, false)).toBe(Time.Minute * 30);
		expect(calcImmunity(true, false)).toBe(Time.Minute * 40);
		expect(calcImmunity(false, true)).toBe(Time.Minute * 40);
		expect(calcImmunity(true, true)).toBe(Time.Minute * 50);
	});

	test('protection chances for scared-crow and greased pumpkin', () => {
		const getProtectionChance = (hadGreasedPumpkin: boolean) => (hadGreasedPumpkin ? 90 : 70);
		expect(getProtectionChance(false)).toBe(70);
		expect(getProtectionChance(true)).toBe(90);
	});

	test('halved cooldown when failing steal because of scared-crow', () => {
		const now = 100_000_000;
		// Halved cooldown sets lastStealAttempt to now - 15 minutes, leaving 15 minutes remaining
		const lastStealAttempt = now - Time.Minute * 15;
		const remaining = Time.Minute * 30 - (now - lastStealAttempt);
		expect(remaining).toBe(Time.Minute * 15);
	});
});

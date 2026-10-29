import { describe, expect, test } from 'vitest';

import { stealables } from '@/lib/skilling/skills/thieving/stealables.js';
import { calcLootXPPickpocketing } from '@/tasks/minions/pickpocketActivity.js';

describe('Thieving', () => {
	test('Shadow Veil protects before consuming necklace charges', () => {
		const hero = stealables.find(entity => entity.name === 'Hero')!;
		const rolls: number[] = [];

		const [successful, damage, xp, , chargesUsed] = calcLootXPPickpocketing(
			99,
			hero,
			1,
			false,
			false,
			false,
			{
				percentChance: percent => {
					rolls.push(percent);
					return percent === 15;
				}
			},
			10,
			99
		);

		expect(successful).toBe(0);
		expect(damage).toBe(0);
		expect(xp).toBe(0);
		expect(chargesUsed).toBe(0);
		expect(rolls).toHaveLength(2);
		expect(rolls[1]).toBe(15);
	});
	test('Necklace protects when Shadow Veil fails', () => {
		const hero = stealables.find(entity => entity.name === 'Hero')!;
		const rolls: number[] = [];

		const [successful, damage, xp, , chargesUsed] = calcLootXPPickpocketing(
			99,
			hero,
			1,
			false,
			false,
			false,
			{
				percentChance: percent => {
					rolls.push(percent);
					return percent === 25;
				}
			},
			10,
			99
		);

		expect(successful).toBe(0);
		expect(damage).toBe(0);
		expect(xp).toBe(0);
		expect(chargesUsed).toBe(1);
		expect(rolls.slice(1)).toEqual([15, 25]);
	});
	test('Necklace stops protecting when its charges run out', () => {
		const hero = stealables.find(entity => entity.name === 'Hero')!;

		const [successful, damage, xp, , chargesUsed] = calcLootXPPickpocketing(
			99,
			hero,
			10,
			false,
			false,
			false,
			{
				percentChance: percent => percent === 25
			},
			1,
			0
		);

		expect(successful).toBe(0);
		expect(xp).toBe(0);
		expect(chargesUsed).toBe(1);
		expect(damage).toBeGreaterThan(0);
	});
	test('Shadow Veil has a three-tick protection gap at 47 Magic', () => {
		const hero = stealables.find(entity => entity.name === 'Hero')!;
		const target = {
			...hero,
			customTickRate: 1,
			stunTime: 0,
			stunDamage: 1,
			slope: 0,
			intercept: 0
		};

		const [successful, damage, xp, , chargesUsed] = calcLootXPPickpocketing(
			99,
			target,
			51,
			false,
			false,
			false,
			{
				percentChance: percent => percent === 15
			},
			0,
			47
		);

		expect(successful).toBe(0);
		expect(damage).toBe(3);
		expect(xp).toBe(0);
		expect(chargesUsed).toBe(0);
	});
	test('All stealables should have a table', () => {
		for (const entity of stealables) {
			if (!entity.table) {
				throw new Error(`No table for ${entity.name}.`);
			}
		}
	});
});

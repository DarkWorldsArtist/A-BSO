import { expect, test } from 'vitest';

import { cleanUsername, formatItemStackQuantity, generateHexColorForCashStack } from '../src/util.js';

test('cleanUsername', () => {
	expect(cleanUsername('just_as')).toEqual('just_as');
	expect(cleanUsername('just as')).toEqual('just as');
	expect(cleanUsername('@justas')).toEqual('justas');
	expect(cleanUsername('*justas*@')).toEqual('justas');
	expect(cleanUsername('|justas')).toEqual('justas');
});

test('formatItemStackQuantity and generateHexColorForCashStack', () => {
	expect(formatItemStackQuantity(1)).toEqual('1');
	expect(formatItemStackQuantity(99_999)).toEqual('99999');
	expect(generateHexColorForCashStack(1)).toEqual('#FFFF00');
	expect(generateHexColorForCashStack(99_999)).toEqual('#FFFF00');

	expect(formatItemStackQuantity(100_000)).toEqual('100K');
	expect(formatItemStackQuantity(9_999_999)).toEqual('9999K');
	expect(generateHexColorForCashStack(100_000)).toEqual('#FFFFFF');
	expect(generateHexColorForCashStack(9_999_999)).toEqual('#FFFFFF');

	expect(formatItemStackQuantity(10_000_000)).toEqual('10M');
	expect(formatItemStackQuantity(999_999_999)).toEqual('999M');
	expect(generateHexColorForCashStack(10_000_000)).toEqual('#00FF80');
	expect(generateHexColorForCashStack(999_999_999)).toEqual('#00FF80');

	expect(formatItemStackQuantity(1_000_000_000)).toEqual('1B');
	expect(formatItemStackQuantity(2_000_000_000)).toEqual('2B');
	expect(formatItemStackQuantity(9_999_999_999)).toEqual('9B');
	expect(formatItemStackQuantity(10_000_000_000)).toEqual('10B');
	expect(formatItemStackQuantity(999_999_999_999)).toEqual('999B');
	expect(generateHexColorForCashStack(1_000_000_000)).toEqual('#00FF80');
	expect(generateHexColorForCashStack(9_999_999_999)).toEqual('#00FF80');
	expect(generateHexColorForCashStack(10_000_000_000)).toEqual('#00FFFF');
	expect(generateHexColorForCashStack(999_999_999_999)).toEqual('#00FFFF');

	expect(formatItemStackQuantity(1_000_000_000_000)).toEqual('1T');
	expect(formatItemStackQuantity(25_900_000_000_000)).toEqual('25T');
	expect(generateHexColorForCashStack(1_000_000_000_000)).toEqual('#D580FF');
});

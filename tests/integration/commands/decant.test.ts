import { Bank } from 'oldschooljs';
import { describe, expect, it } from 'vitest';

import { decantCommand } from '@/mahoji/lib/abstracted_commands/decantCommand.js';
import { createTestUser } from '../util.js';

describe('Decant all', () => {
	it('combines potion types while preserving leftovers, mixes and unrelated items', async () => {
		const user = await createTestUser(
			new Bank({
				'Magic potion (3)': 3,
				'Magic potion (4)': 2,
				'Attack potion (2)': 3,
				'Prayer mix (1)': 3,
				Trout: 10
			})
		);

		const result = await decantCommand(user, 'all', 4);

		expect(result).toContain('You decanted 2 potion types');
		await user.bankMatch(
			new Bank({
				'Magic potion (4)': 4,
				'Magic potion (1)': 1,
				'Attack potion (4)': 1,
				'Attack potion (2)': 1,
				'Prayer mix (1)': 3,
				Trout: 10
			})
		);
	});
	it('decants mixes and regular potions into two doses', async () => {
		const user = await createTestUser(
			new Bank({
				'Prayer mix (1)': 5,
				'Magic potion (3)': 2
			})
		);

		await decantCommand(user, 'all', 2);

		await user.bankMatch(
			new Bank({
				'Prayer mix (2)': 2,
				'Prayer mix (1)': 1,
				'Magic potion (2)': 3
			})
		);
	});
	it('leaves an already-decanted bank unchanged', async () => {
		const originalBank = new Bank({
			'Magic potion (4)': 5,
			'Attack potion (1)': 1,
			'Prayer mix (1)': 3,
			Trout: 10
		});
		const user = await createTestUser(originalBank);

		const result = await decantCommand(user, 'all', 4);

		expect(result).toContain("don't have any potions that need decanting");
		await user.bankMatch(originalBank);
	});
});

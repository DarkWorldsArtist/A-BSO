import { handleSpecialDropNotifications, perkPetsToAnnounce } from '@/lib/bso/specialDropNotifications.js';

import { Events } from '@oldschoolgg/toolkit';
import { Bank, itemID } from 'oldschooljs';
import { describe, expect, test, vi } from 'vitest';

describe('Special Drop Notifications', () => {
	test('perkPetsToAnnounce contains key BSO perk pets', () => {
		expect(perkPetsToAnnounce).toContain(itemID('Shelldon'));
		expect(perkPetsToAnnounce).toContain(itemID('Zippy'));
		expect(perkPetsToAnnounce).toContain(itemID('Doug'));
		expect(perkPetsToAnnounce).toContain(itemID('Remy'));
		expect(perkPetsToAnnounce).toContain(itemID('Lil Lamb'));
		expect(perkPetsToAnnounce).toContain(itemID('Klik'));
		expect(perkPetsToAnnounce).toContain(itemID('Wintertoad'));
		expect(perkPetsToAnnounce).toContain(itemID('Zak'));
		expect(perkPetsToAnnounce).toContain(itemID('Scruffy'));
		expect(perkPetsToAnnounce).toContain(itemID('Skipper'));
		expect(perkPetsToAnnounce).toContain(itemID('Hammy'));
		expect(perkPetsToAnnounce).toContain(itemID('Herbert'));
		expect(perkPetsToAnnounce).toContain(itemID('Doopy'));
	});

	test('handleSpecialDropNotifications emits ServerNotification for perk pet drops', () => {
		const emitMock = vi.fn();
		global.globalClient = {
			emit: emitMock
		} as any;

		const mockUser = {
			badgedUsername: 'TestUser',
			minionName: 'MinionBot'
		} as any;

		// When receiving Shelldon
		handleSpecialDropNotifications({
			user: mockUser,
			itemsAdded: new Bank().add('Shelldon', 1),
			newCL: new Bank().add('Shelldon', 1)
		});

		expect(emitMock).toHaveBeenCalledWith(
			Events.ServerNotification,
			expect.stringContaining('just received their 1st **Shelldon** pet!')
		);

		// When receiving 2nd copy of Zippy
		handleSpecialDropNotifications({
			user: mockUser,
			itemsAdded: new Bank().add('Zippy', 1),
			newCL: new Bank().add('Zippy', 2)
		});

		expect(emitMock).toHaveBeenCalledWith(
			Events.ServerNotification,
			expect.stringContaining('just received their 2nd **Zippy** pet!')
		);

		// Non-pet item should not emit
		emitMock.mockClear();
		handleSpecialDropNotifications({
			user: mockUser,
			itemsAdded: new Bank().add('Coins', 1_000_000).add('Trout', 50),
			newCL: new Bank().add('Coins', 1_000_000).add('Trout', 50)
		});

		expect(emitMock).not.toHaveBeenCalled();
	});
});

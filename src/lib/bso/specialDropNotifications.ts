import { customPetsCL } from '@/lib/bso/collection-log/main.js';

import { Events, formatOrdinal } from '@oldschoolgg/toolkit';
import { type Bank, Items, resolveItems } from 'oldschooljs';

const alreadyAnnouncedPetIDs = resolveItems([
	'Ori',
	'Voidling',
	'Baby kalphite king',
	'Queen black dragonling',
	'Mini moktang',
	'Crush',
	'Baby duckling',
	'Jal-MejJak',
	'Gary',
	'Tzrek-jad',
	'Echo',
	'Noom',
	'Mini akumu',
	'Blabberbeak',
	'Octo',
	'Takon',
	'Steve',
	'Ishi'
]);

export const perkPetsToAnnounce = customPetsCL.filter(id => !alreadyAnnouncedPetIDs.includes(id));

export function handleSpecialDropNotifications({
	user,
	itemsAdded,
	newCL
}: {
	user: MUser;
	itemsAdded: Bank;
	newCL: Bank;
}) {
	for (const petId of perkPetsToAnnounce) {
		if (itemsAdded.has(petId)) {
			const qty = itemsAdded.amount(petId);
			const totalOwned = newCL.amount(petId);
			const pet = Items.get(petId);
			const petName = pet?.name ?? 'Pet';

			const countStr =
				qty > 1
					? `${qty}x **${petName}** pets (total: ${totalOwned})`
					: `their ${formatOrdinal(totalOwned)} **${petName}** pet`;

			const notif = `🎉 **${user.badgedUsername}'s** minion, ${user.minionName}, just received ${countStr}! 🎉`;
			globalClient.emit(Events.ServerNotification, notif);
		}
	}
}

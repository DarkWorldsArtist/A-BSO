import LootTable from '@/structures/LootTable.js';
import { SimpleOpenable } from '@/structures/SimpleOpenable.js';

// Jagex: https://oldschool.runescape.wiki/w/Update:The_Blood_Moon_Rises_%26_Bank_Tags_Tweaks
// Weights are per 1500 Take-eggs actions, not conditional on receiving an egg.
export const maggotEggRates = [
	{ id: 33665, variant: 'base', weight: 300, petRate: 3000 },
	{ id: 33667, variant: 'sickly', weight: 150, petRate: 2500 },
	{ id: 33669, variant: 'warm', weight: 33, petRate: 1250 },
	{ id: 33671, variant: 'pulsating', weight: 6, petRate: 500 },
	{ id: 33673, variant: 'wriggling', weight: 3, petRate: 10 },
	{ id: 33675, variant: 'writhing', weight: 1, petRate: 2 }
] as const;

export const MaggotEggs: SimpleOpenable[] = maggotEggRates.map(
	({ id, variant, petRate }) =>
		new SimpleOpenable({
			id,
			name: 'Maggot egg (' + variant + ')',
			aliases: ['maggot egg (' + variant + ')'],
			table: new LootTable().tertiary(petRate, 'Maggot marquess')
		})
);

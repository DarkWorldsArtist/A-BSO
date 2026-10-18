import type { Item, LootTable } from 'oldschooljs';

interface Crate {
	item: Item;
	key: Item;
	keyCostGP: number;
	table: LootTable;
}

export const keyCrates: Crate[] = [];

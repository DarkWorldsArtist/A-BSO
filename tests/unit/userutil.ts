import type { GearSetup, PartialGearSetup } from '@oldschoolgg/gear';
import { Bank, convertLVLtoXP, Items, LootTable, type SimpleMonster } from 'oldschooljs';
import { isFunction, isObjectType } from 'remeda';

import type { Prisma, User } from '@/prisma/main.js';
import { MUserClass } from '@/lib/user/MUser.js';
import type { BitField } from '../../src/lib/constants.js';
import { constructGearSetup, Gear } from '../../src/lib/structures/Gear.js';

function filterGearSetup(gear: undefined | null | GearSetup | PartialGearSetup): GearSetup | undefined {
	const filteredGear = !gear
		? undefined
		: typeof gear.ammo === 'undefined' || typeof gear.ammo === 'string'
			? constructGearSetup(gear as PartialGearSetup).raw()
			: (gear as GearSetup);
	return filteredGear;
}

export interface MockUserArgs {
	bank?: Bank;
	cl?: Bank;
	QP?: number;
	meleeGear?: GearSetup | PartialGearSetup;
	skills_agility?: number;
	skills_cooking?: number;
	skills_fishing?: number;
	skills_mining?: number;
	skills_smithing?: number;
	skills_woodcutting?: number;
	skills_firemaking?: number;
	skills_runecraft?: number;
	skills_crafting?: number;
	skills_prayer?: number;
	skills_fletching?: number;
	skills_thieving?: number;
	skills_farming?: number;
	skills_herblore?: number;
	skills_hunter?: number;
	skills_construction?: number;
	skills_magic?: number;
	skills_ranged?: number;
	skills_attack?: number;
	skills_strength?: number;
	skills_defence?: number;
	skills_slayer?: number;
	skills_hitpoints?: number;
	skills_invention?: number;
	skills_dungeoneering?: number;
	skills_divination?: number;
	GP?: number;
	bitfield?: BitField[];
	id?: string;
}

const mockUser = (overrides?: MockUserArgs): User => {
	const gearMelee = filterGearSetup(overrides?.meleeGear);
	const cl = new Bank().add(overrides?.cl ?? {});
	const r = {
		cl,
		gear_fashion: new Gear().raw() as Prisma.JsonValue,
		gear_mage: new Gear().raw() as Prisma.JsonValue,
		gear_melee: new Gear(gearMelee).raw() as Prisma.JsonValue,
		gear_misc: new Gear().raw() as Prisma.JsonValue,
		gear_other: new Gear().raw() as Prisma.JsonValue,
		gear_range: new Gear().raw() as Prisma.JsonValue,
		gear_skilling: new Gear().raw() as Prisma.JsonValue,
		gear_wildy: new Gear().raw() as Prisma.JsonValue,
		bank: overrides?.bank?.toJSON() ?? {},
		collectionLogBank: overrides?.cl?.toJSON() ?? {},
		skills_agility: overrides?.skills_agility ?? 0,
		skills_cooking: overrides?.skills_cooking ?? 0,
		skills_fishing: overrides?.skills_fishing ?? 0,
		skills_mining: overrides?.skills_mining ?? 0,
		skills_smithing: overrides?.skills_smithing ?? 0,
		skills_woodcutting: overrides?.skills_woodcutting ?? 0,
		skills_firemaking: overrides?.skills_firemaking ?? 0,
		skills_runecraft: overrides?.skills_runecraft ?? 0,
		skills_crafting: overrides?.skills_crafting ?? 0,
		skills_prayer: overrides?.skills_prayer ?? 0,
		skills_fletching: overrides?.skills_fletching ?? 0,
		skills_thieving: overrides?.skills_thieving ?? 0,
		skills_farming: overrides?.skills_farming ?? 0,
		skills_herblore: overrides?.skills_herblore ?? 0,
		skills_hunter: overrides?.skills_hunter ?? 0,
		skills_construction: overrides?.skills_construction ?? 0,
		skills_magic: overrides?.skills_magic ?? 0,
		skills_ranged: overrides?.skills_ranged ?? 0,
		skills_attack: overrides?.skills_attack ?? 0,
		skills_strength: overrides?.skills_strength ?? 0,
		skills_defence: overrides?.skills_defence ?? 0,
		skills_slayer: overrides?.skills_slayer ?? 0,
		skills_hitpoints: overrides?.skills_hitpoints ?? convertLVLtoXP(10),
		skills_invention: overrides?.skills_invention ?? 0,
		skills_dungeoneering: overrides?.skills_dungeoneering ?? 0,
		skills_divination: overrides?.skills_divination ?? 0,
		GP: overrides?.GP ?? 0,
		bitfield: overrides?.bitfield ?? [],
		username: 'Magnaboy',
		QP: overrides?.QP ?? 0,
		sacrificedValue: 0,
		id: overrides?.id ?? '',
		monsterScores: {},
		badges: []
	} as unknown as User;

	return r;
};

export const mockMUser = (overrides?: MockUserArgs) => {
	const user = new MUserClass(mockUser(overrides));
	return user;
};

export function serializeSnapshotItem(item: any) {
	const result = item;
	for (const [key, value] of Object.entries(result) as [string, any][]) {
		// LootTable
		if (value instanceof LootTable || (isObjectType(value) && 'cachedOptimizedTable' in value)) {
			result[key] = (value as LootTable).allItems
				.map(id => Items.itemNameFromId(id) ?? '???UNKNOWN???')
				.sort((a, b) => a[0].localeCompare(b[0]));
			result[key] = Array.from(new Set(result[key]));
			continue;
		}
		// Bank
		if (value instanceof Bank || (isObjectType(value) && 'frozen' in value)) {
			result[key] = (value as Bank)
				.items()
				.sort((a, b) => a[0].name.localeCompare(b[0].name))
				.map(i => [i[0].name, i[1]]);
			continue;
		}

		// Monsters
		if (
			isObjectType(value) &&
			'data' in value &&
			'aliases' in value &&
			'allItems' in value &&
			'kill' in value &&
			isFunction(value.kill)
		) {
			result[key] = (value as SimpleMonster).allItems
				.map(id => Items.itemNameFromId(id) ?? '???UNKNOWN???')
				.sort((a, b) => a.localeCompare(b));
			continue;
		}

		// Items
		if (
			isObjectType(value) &&
			'id' in value &&
			'name' in value &&
			('tradeable' in value || 'customItemData' in value)
		) {
			result[key] = value.name;
		}
	}
	return result;
}

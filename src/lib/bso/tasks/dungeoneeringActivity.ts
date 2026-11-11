import type { DungeoneeringOptions } from '@/lib/bso/bsoTypes.js';
import { isDoubleLootActive } from '@/lib/bso/doubleLoot.js';
import { MysteryBoxes } from '@/lib/bso/openables/tables.js';
import { chargePortentIfHasCharges, PortentID } from '@/lib/bso/skills/divination.js';
import {
	calcMaxFloorUserCanDo,
	calcUserGorajanShardChance,
	checkKinshipFloorSpread,
	getCurrentKinshipTier,
	getDungeoneeringFloorCompletions,
	numberOfGorajanOutfitsEquipped
} from '@/lib/bso/skills/dungoneering/dungDbFunctions.js';

import { Events, reduceNumByPercent, Time } from '@oldschoolgg/toolkit';
import { randomVariation, roll } from 'node-rng';
import { Bank, toKMB } from 'oldschooljs';

const floorBaseXP: Record<number, number> = {
	1: 1500,
	2: 3500,
	3: 7500,
	4: 14_000,
	5: 24_000,
	6: 40_000,
	7: 65_000,
	8: 95_000,
	9: 135_000,
	10: 185_000
};

export function calculateDungeoneeringResult({
	floor,
	quantity,
	gorajanEquipped,
	hasScrollOfMystery,
	gorajanShardChance,
	duration,
	dungeoneeringLevel,
	maxFloorUserCanDo,
	hasDungeonPortent,
	hasOverchargedRing = false
}: {
	duration: number;
	floor: number;
	quantity: number;
	dungeoneeringLevel: number;
	gorajanEquipped: number;
	hasScrollOfMystery: boolean;
	gorajanShardChance: number;
	maxFloorUserCanDo: number;
	hasDungeonPortent: boolean;
	hasOverchargedRing?: boolean;
}) {
	const minutes = Math.ceil(duration / Time.Minute);

	const baseXp = (floorBaseXP[floor] ?? 1500) * quantity;
	let xp = Math.floor(randomVariation((baseXp * Math.max(1, dungeoneeringLevel)) / 120, 5));
	if (maxFloorUserCanDo > floor) {
		xp = reduceNumByPercent(xp, (maxFloorUserCanDo - floor) * 5);
	}
	if (floor === maxFloorUserCanDo) {
		xp = Math.floor(xp * 1.5);
	}
	if (gorajanEquipped > 0) {
		const bonusXP = Math.floor(xp * (gorajanEquipped / 2));
		xp += bonusXP;
	}
	if (hasOverchargedRing) {
		xp = Math.floor(xp * 1.05);
	}

	let tokens = Math.floor(xp * 0.1);
	if (floor === 8) {
		tokens = Math.floor(tokens * 1.15);
	} else if (floor === 9) {
		tokens = Math.floor(tokens * 1.25);
	} else if (floor === 10) {
		tokens = Math.floor(tokens * 1.4);
	}
	if (hasOverchargedRing) {
		tokens = Math.floor(tokens * 1.05);
	}

	const loot = new Bank();

	let gotMysteryBox = false;
	let boxScrollChance = 5;
	const differenceFromMax = Math.max(0, maxFloorUserCanDo - floor);
	boxScrollChance += Math.floor(differenceFromMax * 11.5);
	for (let i = 0; i < quantity; i++) {
		if (hasScrollOfMystery && roll(boxScrollChance)) {
			loot.add(MysteryBoxes.roll());
			if (!gotMysteryBox) gotMysteryBox = true;
		}
	}

	const goraShardChanceX = Math.floor(gorajanShardChance / minutes);
	if (floor >= 6 && roll(goraShardChanceX)) {
		let qty = 1;
		if (floor === 9 && roll(10)) {
			qty = 2;
		} else if (floor === 10 && roll(5)) {
			qty = 2;
		}
		if (isDoubleLootActive(duration)) {
			qty *= 2;
		}
		loot.add('Gorajan shards', qty);
	}
	if (floor === 10 && roll(Math.max(1, Math.floor(8000 / minutes)))) {
		loot.add('Gorajan bonecrusher (u)', isDoubleLootActive(duration) ? 2 : 1);
	}

	const alyraChance = Math.max(1000, 10_000 - floor * 600);
	for (let i = 0; i < quantity; i++) {
		if (roll(alyraChance)) {
			loot.add('Alyra', 1);
		}
	}

	const portentXP = Math.ceil(tokens * 16.646);
	if (hasDungeonPortent && tokens > 0) {
		xp += portentXP;
		tokens = 0;
	}

	return { xp, tokens, loot, portentXP, goraShardChanceX };
}

export const dungeoneeringTask: MinionTask = {
	type: 'Dungeoneering',
	async run(data: DungeoneeringOptions, { user, handleTripFinish }) {
		const { channelId, duration, floor, quantity, users } = data;

		let str = `<:dungeoneering:1560872468346966108> ${user}, your party finished ${quantity}x Floor level ${floor} dungeons.\n\n`;

		for (const id of users) {
			const u = await mUserFetch(id);
			const gorajanEquipped = numberOfGorajanOutfitsEquipped(u);
			const portentResult = await chargePortentIfHasCharges({
				user: u,
				portentID: PortentID.DungeonPortent,
				charges: Math.floor(duration / Time.Minute)
			});
			const hasOverchargedRing = u.hasEquippedOrInBank('Overcharged ring of kinship');
			const { xp, tokens, loot, portentXP } = calculateDungeoneeringResult({
				floor,
				quantity,
				dungeoneeringLevel: u.skillsAsLevels.dungeoneering,
				gorajanEquipped,
				hasScrollOfMystery: u.bank.has('Scroll of mystery'),
				gorajanShardChance: calcUserGorajanShardChance(u, floor).chance,
				duration,
				maxFloorUserCanDo: calcMaxFloorUserCanDo(u),
				hasDungeonPortent: portentResult.didCharge,
				hasOverchargedRing
			});

			const xpStr = await u.addXP({
				skillName: 'dungeoneering',
				amount: xp,
				duration,
				minimal: false
			});

			await u.addItemsToBank({ items: loot, collectionLog: true });

			const kinshipRings = [
				'Ring of kinship (tier 1)',
				'Ring of kinship (tier 2)',
				'Ring of kinship (tier 3)',
				'Ring of kinship (tier 4)',
				'Overcharged ring of kinship'
			];
			const unlockedKinship = floor === 1 && !u.hasEquippedOrInBank(kinshipRings, 'one');
			if (unlockedKinship) {
				await u.addItemsToBank({
					items: new Bank().add('Ring of kinship (tier 1)'),
					collectionLog: true
				});
			}

			const floorCountsBefore = await getDungeoneeringFloorCompletions(u);
			const totalFloorsBefore = Object.values(floorCountsBefore).reduce((a, b) => a + b, 0);
			const totalFloorsAfter = totalFloorsBefore + quantity;
			const currentRing = getCurrentKinshipTier(u);

			if (tokens > 0) {
				await u.update({
					dungeoneering_tokens: {
						increment: tokens
					}
				});
			}

			if (portentXP > 0) {
				await user.statsUpdate({
					xp_from_dungeon_portent: {
						increment: portentXP
					}
				});
			}

			if (portentResult.didCharge) {
				str += `${u} received: ${xpStr}, ${toKMB(portentXP)} of which is from from their portent (${
					portentResult.portent.charges_remaining
				} charges remaining)`;
			} else {
				str += `${u} received: ${xpStr} and <:dungeoneeringToken:1560872995713458286> ${tokens.toLocaleString()} Dungeoneering tokens${
					loot.length > 0 ? ` and **${loot}**.` : '.'
				}`;
			}

			if (unlockedKinship) {
				str += `\n${u} unlocked the Ring of kinship (tier 1)! (+5% speed boost. Upgrade it via \`/create\` after completing more floors)`;
			}

			if (currentRing && currentRing.tier < 5) {
				const nextTier = currentRing.nextTierName!;
				const reqFloors = currentRing.reqFloors;
				const floorCountsAfter = {
					...floorCountsBefore,
					[floor]: (floorCountsBefore[floor] ?? 0) + quantity
				};
				const spreadReq = currentRing.floorSpreadReq;
				const spreadCheck = spreadReq
					? checkKinshipFloorSpread(floorCountsAfter, spreadReq)
					: { hasSpread: true, missing: [] };
				const spreadCheckBefore = spreadReq
					? checkKinshipFloorSpread(floorCountsBefore, spreadReq)
					: { hasSpread: true, missing: [] };
				const readyAfter = totalFloorsAfter >= reqFloors && spreadCheck.hasSpread;
				const readyBefore = totalFloorsBefore >= reqFloors && spreadCheckBefore.hasSpread;

				if (readyAfter) {
					if (!readyBefore) {
						str += `\n${u.usernameOrMention}, you reached ${totalFloorsAfter}/${reqFloors} floor completions (with floor spread met) and can now upgrade your ring to ${nextTier} using \`/create item: ${nextTier}\` (unequip to bank first).`;
					} else {
						str += `\nRing of kinship: ${totalFloorsAfter}/${reqFloors} floors completed. Ready to upgrade to ${nextTier} using \`/create item: ${nextTier}\` (unequip to bank first).`;
					}
				} else if (totalFloorsAfter >= reqFloors && !spreadCheck.hasSpread) {
					const missingStr = spreadCheck.missing
						.map(m => `F${m.floor}: ${m.current}/${m.required}`)
						.join(', ');
					str += `\nRing of kinship: ${totalFloorsAfter}/${reqFloors} total floors completed, but still need floor spread for ${nextTier} (Missing ${missingStr}).`;
				} else {
					str += `\nRing of kinship: ${totalFloorsAfter}/${reqFloors} floors completed towards ${nextTier}.`;
				}
			}

			if (loot.has('Alyra')) {
				const mothMsg =
					users.length > 1
						? 'While your party moves through the depths of Daemonheim, you come across a moth that is particularly interested in you.'
						: 'While moving through the depths of Daemonheim, you come across a moth that is particularly interested in you.';
				str += `\n**${mothMsg}**`;
				globalClient.emit(
					Events.ServerNotification,
					`**${u.usernameOrMention}'s** minion just received **Alyra** while dungeoneering on Floor ${floor}!`
				);
			}

			str += '\n';
		}

		handleTripFinish({ user, channelId, message: str, data });
	}
};

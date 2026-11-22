import { isGEUntradeable, isSuperUntradeable } from '@/lib/bso/bsoUtil.js';
import { DragonTable } from '@/lib/bso/grandmasterClue.js';
import { Ignecarus } from '@/lib/bso/monsters/bosses/Ignecarus.js';
import { kalphiteKingLootTable } from '@/lib/bso/monsters/bosses/KalphiteKing.js';
import { VasaMagus } from '@/lib/bso/monsters/bosses/VasaMagus.js';
import { BSOMonsters } from '@/lib/bso/monsters/customMonsters.js';
import { nexLootTable } from '@/lib/bso/monsters/nex.js';
import { MysteryBoxes } from '@/lib/bso/openables/tables.js';
import { chargePortentIfHasCharges, PortentID } from '@/lib/bso/skills/divination.js';
import { allThirdAgeItems, runeAlchablesTable } from '@/lib/bso/tables/sharedTables.js';
import { LampTable } from '@/lib/bso/xpLamps.js';

import { dateFm } from '@oldschoolgg/discord';
import { Emoji, formatOrdinal } from '@oldschoolgg/toolkit';
import { randArrItem } from 'node-rng';
import { Bank, type ItemBank, Items, LootTable, resolveItems } from 'oldschooljs';

import { BitField } from '@/lib/constants.js';
import { allPetIDs } from '@/lib/data/CollectionsExport.js';
import { allOpenablesIDs } from '@/lib/openables.js';
import { getESTDateKey, getNextESTMidnight } from '@/lib/util/estTime.js';
import { tradePlayerItems } from '@/lib/util/tradePlayerItems.js';
import { unqueuedTransactItems } from '@/lib/util/transactItemsFromBank.js';
import { userQueueFn } from '@/lib/util/userQueues.js';

export const DAILY_ITEM_CONTRACTS_LIMIT = 3;

export interface ItemContractDetails {
	totalContracts: number;
	streak: number;
	currentItem: ReturnType<typeof Items.getOrThrow> | null;
	nextContractIsReady: boolean;
	contractsRemainingToday: number;
	hasFreeSkipToday: boolean;
	nextReset: Date;
	owns: boolean | null;
	infoStr: string;
}

const contractTable = new LootTable()
	.every('Coins', [2_500_000, 6_000_000])
	.tertiary(25, LampTable)
	.tertiary(20, MysteryBoxes)
	.add(DragonTable, [1, 3], 2)
	.add(runeAlchablesTable, [2, 4], 3)
	.every(runeAlchablesTable, [2, 4])
	.add(
		new LootTable()
			.add('Clue scroll (medium)', 1, 20)
			.add('Clue scroll (hard)', 1, 25)
			.add('Clue scroll (elite)', 1, 15)
			.add('Clue scroll (master)', 1, 8)
			.add('Clue scroll (grandmaster)', 1, 3)
	);

const rawContractCandidates = new Set([
	...kalphiteKingLootTable.allItems,
	...VasaMagus.allItems,
	...Ignecarus.allItems,
	...nexLootTable.allItems,
	...BSOMonsters.FrostDragon.table.allItems,
	...BSOMonsters.GanodermicBeast.table.allItems,
	...BSOMonsters.Grifolaroo.table.allItems,
	...BSOMonsters.RumPumpedCrab.table.allItems,
	...BSOMonsters.QueenBlackDragon.table.allItems,
	...resolveItems(['Dwarven bar', 'Dwarven ore', 'Runite bar', 'Adamantite bar', 'Mahogany plank', 'Teak plank'])
]);

const excludedContractItems = new Set([
	...resolveItems([
		'Coins',
		'Clue scroll (beginner)',
		'Clue scroll (easy)',
		'Clue scroll (medium)',
		'Clue scroll (hard)',
		'Clue scroll (elite)',
		'Clue scroll (master)',
		'Clue scroll (grandmaster)'
	]),
	...allPetIDs,
	...allThirdAgeItems
]);

const itemContractItems = Array.from(rawContractCandidates).filter(id => {
	if (excludedContractItems.has(id)) return false;
	if (allOpenablesIDs.has(id)) return false;
	const item = Items.get(id);
	if (!item) return false;
	if (isSuperUntradeable(item) || isGEUntradeable(item)) return false;
	if ((item.price ?? 0) > 50_000_000) return false;
	return Boolean(item.tradeable);
});

function pickItemContract() {
	return randArrItem(itemContractItems) ?? itemContractItems[0];
}

export async function resetBrokenContracts(user: MUser) {
	await user.update({ current_item_contract: null });
	return 'Sorry, your item contract was reset, please try again.';
}

async function getItemContractDetails(mUser: MUser): Promise<ItemContractDetails | null> {
	const stats = await mUser.fetchStats();
	const todayKey = getESTDateKey();
	const usedToday = stats.ic_daily_date === todayKey ? stats.ic_daily_count : 0;
	const contractsRemainingToday = Math.max(0, DAILY_ITEM_CONTRACTS_LIMIT - usedToday);
	const hasFreeSkipToday = stats.ic_free_skip_date !== todayKey;
	const nextReset = getNextESTMidnight();

	const totalContracts = mUser.user.total_item_contracts;
	const streak = mUser.user.item_contract_streak;
	try {
		const currentItem = mUser.user.current_item_contract
			? Items.getOrThrow(mUser.user.current_item_contract)
			: null;
		const nextContractIsReady = contractsRemainingToday > 0;
		const owns = currentItem ? mUser.bank.has(currentItem.id) : null;
		return {
			totalContracts,
			streak,
			currentItem,
			nextContractIsReady,
			contractsRemainingToday,
			hasFreeSkipToday,
			nextReset,
			owns,
			infoStr: `**Current Contract:** ${
				currentItem
					? `${currentItem.name} (ID: ${currentItem.id}) (You${owns ? '' : " don't"} own it)`
					: '*None*'
			}
**Contracts Remaining Today:** ${contractsRemainingToday}/${DAILY_ITEM_CONTRACTS_LIMIT} (Resets ${dateFm(nextReset)})
**Free Skip Available:** ${hasFreeSkipToday ? 'Yes' : 'No (resets midnight EST)'}
**Current Streak:** ${streak}
**Total Contracts Completed:** ${totalContracts}`
		};
	} catch {
		return null;
	}
}

async function skip(interaction: MInteraction, user: MUser) {
	const details = await getItemContractDetails(user);
	if (details === null) {
		return resetBrokenContracts(user);
	}
	const { currentItem, hasFreeSkipToday } = details;
	if (!currentItem) return "You don't have a contract to skip.";

	if (hasFreeSkipToday) {
		await interaction.confirmation(
			`Use your free daily skip to replace **${currentItem.name}** without losing your streak?`
		);
		const newItem = pickItemContract();
		const todayKey = getESTDateKey();
		await Promise.all([
			user.update({ current_item_contract: newItem }),
			user.statsUpdate({ ic_free_skip_date: todayKey })
		]);
		return `Used your free daily skip! Your streak was preserved and your new contract is **${Items.itemNameFromId(newItem)}**.`;
	}

	await interaction.confirmation(
		`You already used your free daily skip today. Skipping **${currentItem.name}** again will reset your streak to 0. Continue?`
	);

	const newItem = pickItemContract();
	await user.update({
		current_item_contract: newItem,
		item_contract_streak: 0
	});

	return `You skipped your item contract, your streak was reset to 0, and your new contract is **${Items.itemNameFromId(newItem)}**.`;
}

async function icDonateValidation(user: MUser, donator: MUser) {
	if (user.isIronman) {
		return 'Ironmen stand alone!';
	}
	if (user.id === donator.id) {
		return 'You cannot donate to yourself.';
	}
	if (user.bitfield.includes(BitField.NoItemContractDonations)) {
		return "That user doesn't want donations.";
	}
	const details = await getItemContractDetails(user);
	if (!details) return resetBrokenContracts(user);

	if (!details.nextContractIsReady || !details.currentItem) {
		return "That user's Item Contract isn't ready.";
	}

	const cost = new Bank().add(details.currentItem.id);
	if (!donator.bank.has(cost)) {
		return `You don't own ${cost}.`;
	}

	return {
		cost,
		details
	};
}

async function donateICHandler(interaction: MInteraction): CommandResponse {
	if (!interaction.customId) return { content: 'Invalid interaction.', ephemeral: true };
	const userID = interaction.customId.split('_')[2];
	if (!userID) {
		return { content: 'Invalid user.', ephemeral: true };
	}

	const user = await mUserFetch(userID);
	const donator = await mUserFetch(interaction.userId);

	const errorStr = await icDonateValidation(user, donator);
	if (typeof errorStr === 'string') return { content: errorStr, ephemeral: true };

	await interaction.confirmation({
		content: `${donator}, are you sure you want to give ${errorStr.cost} to ${
			user.badgedUsername
		}? You own ${donator.bank.amount(errorStr.details.currentItem!.id)} of this item.`,
		users: [donator.id]
	});

	await user.sync();
	await donator.sync();

	const secondaryErrorStr = await icDonateValidation(user, donator);
	if (typeof secondaryErrorStr === 'string') return { content: secondaryErrorStr };
	const { cost } = secondaryErrorStr;

	try {
		const tradeResult = await tradePlayerItems(donator, user, cost);
		if (!tradeResult.success) {
			return { content: tradeResult.message };
		}
		await donator.statsBankUpdate('ic_donations_given_bank', cost);
		await user.statsBankUpdate('ic_donations_received_bank', cost);
		const handInResult = await handInContract(interaction, user, { skipConfirmation: true });
		const nextIcDetails = await getItemContractDetails(user);
		if (!nextIcDetails) {
			await resetBrokenContracts(user);
			return {
				content: 'Your contract was reset due to an invalid item.'
			};
		}
		return {
			content: `${donator} donated ${cost} for ${user}'s Item Contract!\n\n${user.mention} ${handInResult}\n\n${Emoji.ItemContract} Your next contract is: ${nextIcDetails.currentItem?.name}.`,
			allowedMentions: {
				users: [user.id]
			}
		};
	} catch (err) {
		Logging.logError(err as Error);
		return { content: 'There was an error processing the trade. Please try again later.' };
	}
}

async function handInContract(
	interaction: MInteraction,
	user: MUser,
	options: { skipConfirmation?: boolean } = {}
): Promise<string> {
	const details = await getItemContractDetails(user);
	if (!details) {
		return resetBrokenContracts(user);
	}
	const { nextContractIsReady, nextReset, currentItem, owns, streak } = details;

	if (!nextContractIsReady) {
		return `You have completed all ${DAILY_ITEM_CONTRACTS_LIMIT} Item Contracts for today! Resets at midnight EST (${dateFm(nextReset)}).`;
	}

	if (!currentItem) {
		const assigned = pickItemContract();
		await user.update({
			current_item_contract: assigned
		});
		return `You were assigned a new item contract: **${Items.itemNameFromId(assigned)}**.`;
	}

	if (!owns) {
		return `Your current contract is a ${currentItem.name} (ID: ${currentItem.id}), go get one!`;
	}
	const cost = new Bank().add(currentItem.id);
	const newStreak = streak + 1;

	if (!options.skipConfirmation) {
		await interaction.confirmation(
			`Are you sure you want to hand in ${cost} for your ${formatOrdinal(newStreak)} Item Contract?`
		);
	}

	return userQueueFn(user.id, async () => {
		await user.sync();
		const freshDetails = await getItemContractDetails(user);
		if (!freshDetails) {
			return resetBrokenContracts(user);
		}

		const {
			nextContractIsReady: freshNextContractIsReady,
			nextReset: freshNextReset,
			currentItem: freshCurrentItem,
			owns: freshOwns,
			streak: freshStreak,
			totalContracts: freshTotalContracts
		} = freshDetails;

		if (!freshNextContractIsReady) {
			return `You have completed all ${DAILY_ITEM_CONTRACTS_LIMIT} Item Contracts for today! Resets at midnight EST (${dateFm(freshNextReset)}).`;
		}

		if (!freshCurrentItem) {
			await user.update({
				current_item_contract: pickItemContract()
			});
			return 'You were given a new item contract.';
		}

		if (!freshOwns) {
			return `Your current contract is a ${freshCurrentItem.name} (ID: ${freshCurrentItem.id}), go get one!`;
		}

		return finishContract(user, freshCurrentItem, freshStreak, freshTotalContracts);
	});
}

async function finishContract(
	user: MUser,
	currentItem: ReturnType<typeof Items.getOrThrow>,
	streak: number,
	totalContracts: number
) {
	const cost = new Bank().add(currentItem.id);
	const newStreak = streak + 1;
	const loot = new Bank().add(contractTable.roll());
	const streakBonusMult = 1 + Math.min(0.5, Math.floor(newStreak / 5) * 0.05);
	const baseCoins = loot.amount('Coins');
	if (baseCoins > 0) {
		loot.set('Coins', Math.floor(baseCoins * streakBonusMult));
	}

	let gotBonus = '';
	for (const [kc, rolls] of [
		[100, 25],
		[50, 15],
		[25, 10],
		[10, 5],
		[5, 2]
	]) {
		if (newStreak % kc === 0) {
			gotBonus = `You got ${rolls} bonus rolls for your ${formatOrdinal(newStreak)} contract!`;
			for (let i = 0; i < rolls; i++) {
				loot.add(contractTable.roll());
				loot.add(runeAlchablesTable.roll(4));
			}
			break;
		}
	}

	const { didCharge } = await chargePortentIfHasCharges({
		user,
		portentID: PortentID.LuckyPortent,
		charges: 1
	});
	if (didCharge) {
		await user.statsBankUpdate('loot_from_lucky_portent', loot);
		loot.multiply(2);
	}

	const todayKey = getESTDateKey();
	const stats = await user.fetchStats();
	const newDailyCount = stats.ic_daily_date === todayKey ? stats.ic_daily_count + 1 : 1;

	await unqueuedTransactItems({
		user,
		itemsToRemove: cost,
		itemsToAdd: loot,
		collectionLog: false,
		otherUpdates: {
			last_item_contract_date: Date.now(),
			total_item_contracts: {
				increment: 1
			},
			current_item_contract: pickItemContract(),
			item_contract_bank: new Bank()
				.add(currentItem.id)
				.add(user.user.item_contract_bank as ItemBank)
				.toJSON(),
			item_contract_streak: {
				increment: 1
			}
		}
	});

	await Promise.all([
		user.statsUpdate({
			ic_daily_date: todayKey,
			ic_daily_count: newDailyCount
		}),
		ClientSettings.updateBankSetting('item_contract_cost', cost),
		ClientSettings.updateBankSetting('item_contract_loot', loot),
		ClientSettings.updateClientGPTrackSetting('gp_ic', loot.amount('Coins')),
		user.statsBankUpdate('ic_cost_bank', cost),
		user.statsBankUpdate('ic_loot_bank', loot)
	]);

	let res = `You handed in a ${currentItem.name} and received ${loot}. You've completed ${
		totalContracts + 1
	} Item Contracts, and your streak is now at ${newStreak}.`;
	if (gotBonus.length > 0) {
		res += `\n\n${gotBonus}`;
	}
	if (didCharge) {
		res += '\n\nYour Lucky Portent doubled your loot!';
	}
	return res;
}

export const ItemContracts = {
	skip,
	handInContract,
	donateICHandler,
	getItemContractDetails
};

import { nexCL, nexUniqueDrops } from '@/lib/bso/collection-log/main.js';
import { isDoubleLootActive } from '@/lib/bso/doubleLoot.js';
import { NexMonster } from '@/lib/bso/monsters/nex.js';
import { getNexGearStats } from '@/lib/bso/util/getNexGearStats.js';

import { calcWhatPercent, noOp } from '@oldschoolgg/toolkit';
import { Bank } from 'oldschooljs';

import { trackLoot } from '@/lib/lootTrack.js';
import announceLoot from '@/lib/minions/functions/announceLoot.js';
import { TeamLoot } from '@/lib/simulation/TeamLoot.js';
import type { BossActivityTaskOptions } from '@/lib/types/minions.js';

interface NexUser {
	id: string;
	chanceOfDeath: number;
	damageDone: number;
	dps: number;
	user: MUser;
}

export const nexTask: MinionTask = {
	type: 'Nex',
	async run(data: BossActivityTaskOptions, { handleTripFinish, rng }) {
		const { channelId, userID, users, quantity, duration } = data;
		const teamsLoot = new TeamLoot([]);
		const kcAmounts: { [key: string]: number } = {};

		const parsedUsers: NexUser[] = [];

		for (const id of users) {
			const user = await mUserFetch(id).catch(noOp);
			if (!user) continue;
			const [gearStats] = await getNexGearStats(user, users);
			parsedUsers.push({ ...gearStats, id: user.id, user });
		}

		const totalPartyDps = parsedUsers.reduce((sum, u) => sum + u.dps, 0);
		for (const u of parsedUsers) {
			u.damageDone = Math.max(1, Math.round(6000 * (u.dps / totalPartyDps)));
			if (totalPartyDps < users.length * 80) {
				const dpsRatio = Math.max(0.5, totalPartyDps / (users.length * 100));
				if (dpsRatio < 1) {
					u.chanceOfDeath = Math.min(95, Math.round(u.chanceOfDeath / dpsRatio));
				}
			}
		}

		const deaths: Record<string, number> = {};

		for (let i = 0; i < quantity; i++) {
			const deathsThisKill: Record<string, number> = {};

			let teamFailed = false;
			for (const user of [...parsedUsers].sort((a, b) => b.chanceOfDeath - a.chanceOfDeath)) {
				const currentDeaths = Object.keys(deathsThisKill).length;
				if (calcWhatPercent(currentDeaths, users.length) > 75) {
					teamFailed = true;
				}

				if (teamFailed || rng.percentChance(user.chanceOfDeath)) {
					deaths[user.id] = (deaths[user.id] ?? 0) + 1;
					deathsThisKill[user.id] = 1;
				}
			}

			if (teamFailed) continue;

			const survivors = parsedUsers.filter(u => !deathsThisKill[u.id]);
			if (survivors.length === 0) continue;

			let mvpUser = survivors[0];
			for (const s of survivors) {
				if (s.damageDone > mvpUser.damageDone) {
					mvpUser = s;
				}
			}

			for (const survivor of survivors) {
				kcAmounts[survivor.id] = (kcAmounts[survivor.id] ?? 0) + 1;

				const userLoot = new Bank();
				const regularLoot = NexMonster.table.kill(1, {});
				for (const [item, qty] of regularLoot.items()) {
					const finalQty = survivor.id === mvpUser.id ? Math.max(1, Math.round(qty * 1.1)) : qty;
					userLoot.add(item.id, finalQty);
				}

				const rollChance = Math.max(1, Math.round(80 * (6000 / survivor.damageDone)));
				if (rng.roll(rollChance)) {
					userLoot.add(rng.pick(nexUniqueDrops), 1);
				}

				if (isDoubleLootActive(duration)) {
					userLoot.multiply(2);
				}

				teamsLoot.add(survivor.id, userLoot);
			}
		}

		const leaderUser =
			parsedUsers.find(p => p.id === userID)?.user ?? parsedUsers[0]?.user ?? (await mUserFetch(userID));
		let resultStr = `${leaderUser}, your party finished killing ${quantity}x ${NexMonster.name}!\n\n`;
		const totalLoot = new Bank();

		let soloXP = '';
		let soloPrevCl = new Bank();
		let soloItemsAdded: Bank = new Bank();

		for (const [lootRecipientId, loot] of teamsLoot.entries()) {
			const parsedUser = parsedUsers.find(p => p.id === lootRecipientId);
			if (!parsedUser) continue;
			const { user } = parsedUser;
			let xpStr = '';
			if (kcAmounts[user.id]) {
				xpStr = await user.addMonsterXP({
					monsterID: NexMonster.id,
					quantity: kcAmounts[user.id],
					duration,
					isOnTask: false,
					taskQuantity: null
				});
			}
			totalLoot.add(loot);
			const { previousCL, itemsAdded } = await user.addItemsToBank({ items: loot, collectionLog: true });

			if (user.id === userID) {
				soloXP = xpStr;
				soloPrevCl = previousCL;
				soloItemsAdded = itemsAdded;
			}

			const kcToAdd = kcAmounts[user.id];
			if (kcToAdd) await user.incrementKC(NexMonster.id, kcToAdd);
			const purple = loot.itemIDs.some(id => nexCL.includes(id));

			resultStr += `${purple ? '**[UNIQUE]** ' : ''}**${user} received:** ||${new Bank(loot)}||\n`;

			announceLoot({
				user: leaderUser,
				monsterID: NexMonster.id,
				loot: new Bank(loot),
				notifyDrops: NexMonster.notifyDrops,
				team: {
					leader: leaderUser,
					lootRecipient: user,
					size: users.length
				}
			});
		}

		await ClientSettings.updateBankSetting('nex_loot', totalLoot);
		await trackLoot({
			duration,
			totalLoot,
			type: 'Monster',
			changeType: 'loot',
			id: NexMonster.name,
			kc: quantity,
			users: users.map(i => ({
				id: i,
				loot: teamsLoot.get(i),
				duration
			}))
		});

		// Show deaths in the result
		const deathEntries = Object.entries(deaths);
		if (deathEntries.length > 0) {
			const deathStrs = [];
			for (const [id, qty] of deathEntries) {
				const parsed = parsedUsers.find(p => p.id === id);
				if (!parsed) continue;
				deathStrs.push(`**${parsed.user.usernameOrMention}**: ${qty}x`);
			}
			resultStr += `\n**Deaths**: ${deathStrs.join(', ')}.`;
		}

		if (users.length > 1) {
			if (Object.values(kcAmounts).length === 0) {
				resultStr = `${users.map(id => `<@${id}>`).join(' ')} Your team all died, and failed to defeat Nex.`;
			}
			return handleTripFinish({ user: leaderUser, channelId, message: resultStr, data });
		}
		const message = new MessageBuilder().setContent(
			!kcAmounts[userID]
				? `${leaderUser}, ${leaderUser.minionName} died in all their attempts to kill Nex, they apologize and promise to try harder next time.`
				: `${leaderUser}, ${leaderUser.minionName} finished killing ${quantity} ${
						NexMonster.name
					}, you died ${deaths[userID] ?? 0} times. Your Nex KC is now ${await leaderUser.getKC(
						NexMonster.id
					)}.\n\n${soloXP}`
		);

		if (kcAmounts[userID]) {
			message.addBankImage({
				bank: soloItemsAdded,
				title: `Loot From ${quantity} ${NexMonster.name}:`,
				user: leaderUser,
				previousCL: soloPrevCl
			});
		}
		return handleTripFinish({
			user: leaderUser,
			channelId,
			message,
			data,
			loot: soloItemsAdded
		});
	}
};

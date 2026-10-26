import { formatDuration, Time } from '@oldschoolgg/toolkit';

import { BOT_TYPE } from '@/lib/constants.js';
import { getUsersPerkTier } from '@/lib/perkTiers.js';

export const BOND_PLAYTIME_REQUIRED_MS = Time.Day * 30;
export const BOND_PATRON_DURATION_MS = Time.Day * 7;
export const BOND_PERK_TIER = 4;
export const BOND_DISPLAY_PATRON_TIER = 3;
export const BOND_ALERT_CHANNEL_ID = '1536892580116303892';
const BOND_AUDIT_WINDOW_MS = Time.Day * 30;

async function fetchLocalCompletedPlaytimeMs(userId: string): Promise<bigint> {
	const rows = await prisma.$queryRaw<{ total_ms: bigint }[]>`
		SELECT COALESCE(SUM(duration), 0)::bigint AS total_ms
		FROM activity
		WHERE user_id = ${BigInt(userId)} AND completed = true;
	`;
	return BigInt(rows[0]?.total_ms ?? 0n);
}

export async function recordBondPlaytimeFromActivity(userId: string, durationMs: number): Promise<void> {
	if (!Number.isFinite(durationMs) || durationMs <= 0) return;

	const userBigId = BigInt(userId);
	const current = await roboChimpClient.user.upsert({
		where: { id: userBigId },
		create: { id: userBigId },
		update: {}
	});

	const baselineKey = BOT_TYPE === 'OSB' ? 'bond_osb_baseline_ms' : 'bond_bso_baseline_ms';
	const existingBaseline = current[baselineKey];
	const durationBig = BigInt(Math.floor(durationMs));

	let nextBaseline: bigint;
	if (existingBaseline === null || existingBaseline === undefined) {
		nextBaseline = await fetchLocalCompletedPlaytimeMs(userId);
	} else {
		nextBaseline = BigInt(existingBaseline) + durationBig;
	}

	let totalPlaytime = BigInt(current.bond_playtime_ms ?? 0n) + durationBig;
	const requiredBig = BigInt(BOND_PLAYTIME_REQUIRED_MS);
	let earnedBonds = 0;

	if (totalPlaytime >= requiredBig) {
		earnedBonds = Number(totalPlaytime / requiredBig);
		totalPlaytime %= requiredBig;
	}

	const updatedUser = await roboChimpClient.user.update({
		where: { id: userBigId },
		data: {
			bonds: { increment: earnedBonds },
			bond_playtime_ms: totalPlaytime,
			[baselineKey]: nextBaseline
		}
	});

	await Cache.setRoboChimpUser(userId, updatedUser);
}

export async function syncLocalUserBondPlaytime(userId: string) {
	const userBigId = BigInt(userId);
	const [localTotalMs, current] = await Promise.all([
		fetchLocalCompletedPlaytimeMs(userId),
		roboChimpClient.user.upsert({
			where: { id: userBigId },
			create: { id: userBigId },
			update: {}
		})
	]);

	const baselineKey = BOT_TYPE === 'OSB' ? 'bond_osb_baseline_ms' : 'bond_bso_baseline_ms';
	const existingBaseline = current[baselineKey];

	let playtimeMs = BigInt(current.bond_playtime_ms ?? 0n);
	let currentBonds = current.bonds ?? 0;

	if (existingBaseline !== null && existingBaseline !== undefined && localTotalMs > existingBaseline) {
		playtimeMs += localTotalMs - existingBaseline;
	}

	const requiredBig = BigInt(BOND_PLAYTIME_REQUIRED_MS);
	if (playtimeMs >= requiredBig) {
		const earned = Number(playtimeMs / requiredBig);
		playtimeMs %= requiredBig;
		currentBonds += earned;
	}

	const updated = await roboChimpClient.user.update({
		where: { id: userBigId },
		data: {
			bonds: currentBonds,
			bond_playtime_ms: playtimeMs,
			[baselineKey]: localTotalMs
		}
	});

	await Cache.setRoboChimpUser(userId, updated);
	return updated;
}

export async function getBondStatusForUser(user: MUser): Promise<string> {
	const roboUser = await syncLocalUserBondPlaytime(user.id);
	const earnedBonds = roboUser.bonds ?? 0;
	const giftedBonds = roboUser.gifted_bonds ?? 0;
	const totalRedeemable = earnedBonds + giftedBonds;
	const playtimeMs = Number(roboUser.bond_playtime_ms ?? 0n);
	const remainingMs = Math.max(0, BOND_PLAYTIME_REQUIRED_MS - playtimeMs);
	const percent = Math.min(100, (playtimeMs / BOND_PLAYTIME_REQUIRED_MS) * 100).toFixed(2);

	const now = Date.now();
	const expiry = roboUser.premium_balance_expiry_date ? Number(roboUser.premium_balance_expiry_date) : null;
	const hasActivePatron = expiry !== null && expiry > now && roboUser.premium_balance_tier !== null;
	const activePatronStr = hasActivePatron
		? `Tier ${Math.max(1, roboUser.premium_balance_tier! - 1)} Patron (${formatDuration(expiry! - now)} remaining)`
		: 'None';

	return [
		`**Patron Bonds Status for ${user.usernameOrMention}**`,
		`**Total Redeemable Bonds:** ${totalRedeemable} (${earnedBonds} earned, ${giftedBonds} gifted)`,
		`**Progress to Next Bond:** ${formatDuration(playtimeMs)} / ${formatDuration(BOND_PLAYTIME_REQUIRED_MS)} (${percent}%)`,
		`**Remaining Playtime Needed:** ${formatDuration(remainingMs)}`,
		`**Active Temporary Patron Time:** ${activePatronStr}`,
		`Every 30 days of combined AOSB and ABSO minion playtime rewards 1 Bond (1 week of Tier ${BOND_DISPLAY_PATRON_TIER} Patron).`
	].join('\n');
}

export async function redeemUserBonds(
	user: MUser,
	quantity: number,
	interaction: MInteraction | null
): Promise<string> {
	if (!Number.isInteger(quantity) || quantity < 1 || quantity > 52) {
		return 'Quantity must be between 1 and 52.';
	}

	const roboUser = await syncLocalUserBondPlaytime(user.id);
	const earnedBonds = roboUser.bonds ?? 0;
	const giftedBonds = roboUser.gifted_bonds ?? 0;
	const totalRedeemable = earnedBonds + giftedBonds;

	if (totalRedeemable < quantity) {
		return `You only have ${totalRedeemable} redeemable bond(s) (${earnedBonds} earned, ${giftedBonds} gifted).`;
	}

	const now = Date.now();
	const currentExpiry = roboUser.premium_balance_expiry_date ? Number(roboUser.premium_balance_expiry_date) : null;
	const hasActiveBalance = currentExpiry !== null && currentExpiry > now;

	if (hasActiveBalance && roboUser.premium_balance_tier && roboUser.premium_balance_tier > BOND_PERK_TIER) {
		return `You already have an active Tier ${roboUser.premium_balance_tier - 1} temporary patron balance. Wait for it to expire before redeeming a Tier ${BOND_DISPLAY_PATRON_TIER} bond.`;
	}

	const durationToAdd = quantity * BOND_PATRON_DURATION_MS;

	if (interaction) {
		await interaction.confirmation(
			`Are you sure you want to redeem ${quantity}x Bond for ${formatDuration(durationToAdd)} of Tier ${BOND_DISPLAY_PATRON_TIER} Patron?`
		);
	}

	const useFromGifted = Math.min(giftedBonds, quantity);
	const useFromEarned = quantity - useFromGifted;
	const baseExpiry = hasActiveBalance && roboUser.premium_balance_tier === BOND_PERK_TIER ? currentExpiry! : now;
	const newExpiry = baseExpiry + durationToAdd;

	const updatedUser = await roboChimpClient.user.update({
		where: { id: BigInt(user.id) },
		data: {
			gifted_bonds: { decrement: useFromGifted },
			bonds: { decrement: useFromEarned },
			perk_tier: Math.max(roboUser.perk_tier ?? 0, BOND_PERK_TIER),
			premium_balance_tier: BOND_PERK_TIER,
			premium_balance_is_cyr: true,
			premium_balance_expiry_date: BigInt(newExpiry)
		}
	});

	await Cache.setRoboChimpUser(user.id, updatedUser);
	await getUsersPerkTier({ user, forceNoCache: true });

	const remainingTotal = updatedUser.bonds + updatedUser.gifted_bonds;
	return `You redeemed **${quantity}x Bond** for **${formatDuration(durationToAdd)}** of **Tier ${BOND_DISPLAY_PATRON_TIER} Patron**! You have **${formatDuration(newExpiry - Date.now())}** of patron time remaining and **${remainingTotal}** bond(s) left.`;
}

async function getGroupUserIds(userId: bigint): Promise<bigint[]> {
	const u = await roboChimpClient.user.findUnique({
		where: { id: userId },
		select: { user_group_id: true }
	});
	if (!u?.user_group_id) return [userId];
	const members = await roboChimpClient.user.findMany({
		where: { user_group_id: u.user_group_id },
		select: { id: true }
	});
	return members.length > 0 ? members.map(m => m.id) : [userId];
}

export async function flagSuspiciousBondEconomyActivity(
	senderId: string | bigint,
	recipientId: string | bigint,
	txType: string,
	summary: string
): Promise<void> {
	try {
		const senderBig = BigInt(senderId);
		const recipientBig = BigInt(recipientId);
		if (senderBig === recipientBig) return;

		const [senderGroup, recipientGroup] = await Promise.all([
			getGroupUserIds(senderBig),
			getGroupUserIds(recipientBig)
		]);

		const sinceDate = new Date(Date.now() - BOND_AUDIT_WINDOW_MS);
		const matchingGifts = await roboChimpClient.bondGiftLog.findMany({
			where: {
				created_at: { gte: sinceDate },
				OR: [
					{ sender_id: { in: senderGroup }, recipient_id: { in: recipientGroup } },
					{ sender_id: { in: recipientGroup }, recipient_id: { in: senderGroup } }
				]
			},
			orderBy: { created_at: 'desc' },
			take: 5
		});

		if (matchingGifts.length === 0) return;

		const gift = matchingGifts[0];
		const detailText = `[${BOT_TYPE}] ${txType.toUpperCase()}: ${summary}`;
		const txRef = `${BOT_TYPE}:${txType}:${senderBig}:${recipientBig}:${Math.floor(Date.now() / 60000)}`;

		await roboChimpClient.bondGiftLog.update({
			where: { id: gift.id },
			data: {
				flagged: true,
				flag_reason: gift.flag_reason ? `${gift.flag_reason}\n${detailText}`.slice(0, 1500) : detailText
			}
		});

		const existingAlert = await roboChimpClient.bondRwtAlert.findUnique({
			where: { transaction_ref: txRef }
		});
		if (existingAlert) return;

		await roboChimpClient.bondRwtAlert.create({
			data: {
				gift_log_id: gift.id,
				bot_type: BOT_TYPE,
				transaction_ref: txRef,
				sender_id: gift.sender_id,
				recipient_id: gift.recipient_id,
				details: detailText
			}
		});

		await globalClient
			.sendMessage(BOND_ALERT_CHANNEL_ID, {
				content: `**Suspicious Bond / Economy Activity Detected (${BOT_TYPE})**\n• **Bond Gift:** <@${gift.sender_id}> -> <@${gift.recipient_id}> (${gift.quantity}x on ${gift.created_at.toISOString().slice(0, 10)})\n• **Transaction:** <@${senderBig}> -> <@${recipientBig}> (${detailText})`
			})
			.catch(() => null);
	} catch {}
}

export async function giftUserBonds(
	sender: MUser,
	recipient: MUser,
	quantity: number,
	interaction: MInteraction | null
): Promise<string> {
	if (sender.id === recipient.id) {
		return 'You cannot gift a bond to yourself.';
	}

	if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
		return 'Quantity must be between 1 and 20.';
	}

	const senderRobo = await syncLocalUserBondPlaytime(sender.id);
	if (senderRobo.bonds < quantity) {
		if (senderRobo.gifted_bonds > 0) {
			return `You only have ${senderRobo.bonds} giftable earned bond(s). Gifted bonds (${senderRobo.gifted_bonds}) can only be redeemed on your own account and cannot be re-gifted.`;
		}
		return `You only have ${senderRobo.bonds} earned bond(s) available to gift.`;
	}

	if (interaction) {
		await interaction.confirmation(
			`Are you sure you want to gift **${quantity}x Bond** to ${recipient.usernameOrMention}?\n\n**WARNING:** Selling or trading bonds for in-game GP, items, or services on OSB or BSO is strictly prohibited and automatically tracked. Any compensation exchanged will result in both accounts being blacklisted.`
		);
	}

	await roboChimpClient.user.upsert({
		where: { id: BigInt(recipient.id) },
		create: { id: BigInt(recipient.id) },
		update: {}
	});

	const [updatedSender, updatedRecipient, giftLog] = await roboChimpClient.$transaction([
		roboChimpClient.user.update({
			where: { id: BigInt(sender.id) },
			data: { bonds: { decrement: quantity } }
		}),
		roboChimpClient.user.update({
			where: { id: BigInt(recipient.id) },
			data: { gifted_bonds: { increment: quantity } }
		}),
		roboChimpClient.bondGiftLog.create({
			data: {
				sender_id: BigInt(sender.id),
				recipient_id: BigInt(recipient.id),
				quantity
			}
		})
	]);

	await Promise.all([
		Cache.setRoboChimpUser(sender.id, updatedSender),
		Cache.setRoboChimpUser(recipient.id, updatedRecipient)
	]);

	try {
		const [senderGroup, recipientGroup] = await Promise.all([
			getGroupUserIds(BigInt(sender.id)),
			getGroupUserIds(BigInt(recipient.id))
		]);
		const sinceDate = new Date(Date.now() - BOND_AUDIT_WINDOW_MS);
		const recentEcon = await prisma.economyTransaction.findMany({
			where: {
				date: { gte: sinceDate },
				OR: [
					{ sender: { in: senderGroup }, recipient: { in: recipientGroup } },
					{ sender: { in: recipientGroup }, recipient: { in: senderGroup } }
				]
			},
			orderBy: { date: 'desc' },
			take: 5
		});

		if (recentEcon.length > 0) {
			const summary = recentEcon
				.map(
					e =>
						`[${BOT_TYPE}] ${e.type.toUpperCase()} (${e.date.toISOString().slice(0, 10)}): ${e.sender} -> ${e.recipient}`
				)
				.join('\n');

			await roboChimpClient.bondGiftLog.update({
				where: { id: giftLog.id },
				data: {
					flagged: true,
					flag_reason: summary
				}
			});

			await globalClient
				.sendMessage(BOND_ALERT_CHANNEL_ID, {
					content: `**Suspicious Bond Gift Detected (${BOT_TYPE})**\n• **Bond Gift:** <@${sender.id}> -> <@${recipient.id}> (${quantity}x)\n• **Prior Economy Transactions Found:**\n${summary}`
				})
				.catch(() => null);
		}
	} catch {}

	return `You gifted **${quantity}x Bond** to ${recipient.usernameOrMention}! They can redeem it using \`/bonds redeem\` for **${quantity * 7} days** of **Tier ${BOND_DISPLAY_PATRON_TIER} Patron**.`;
}
